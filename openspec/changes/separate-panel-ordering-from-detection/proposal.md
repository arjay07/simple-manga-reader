## Why

Panel detection has two distinct stages with wildly different costs and stability:

1. **Detection** — `detectPanelsMl()` runs a YOLO ONNX model over a page image. Seconds per page, GPU/CPU-bound, effectively a fixed function of the page bitmap.
2. **Ordering** — `assignReadingOrder()` partitions the detected boxes (recursive XY-cut) and assigns RTL manga reading order. Sub-millisecond, pure, and **the part we actually keep changing** (see the history in `src/lib/panel-detect/reading-order.ts`).

Today these stages are fused at the storage layer. `panel_data` persists the *ordered* `Panel[]` (with `readingOrder` baked in) plus the derived `reading_tree_json`. The raw detector output is discarded. The consequence: **applying an ordering change to an already-detected 200-page volume requires re-running YOLO over the entire volume**, even though the detection output hasn't changed at all. Developing and unit-validating an ordering change is already cheap (the `assignReadingOrder` test baseline from `modularize-panel-detect` §0), but *propagating* it to the stored corpus — and eyeballing the result on real pages — is not.

This change separates the two stages at the storage boundary so ordering can be recomputed over stored raw panels cheaply, without re-detection.

**Note:** The first ordering-algorithm fix — replacing the row-grouping + deferral heuristic with a recursive XY-cut (which fixes tall-middle-column layouts) — has already landed independently on `main`, validated against the §0 fixtures. It did not need this storage separation; the test baseline alone was enough. This change is therefore *not* about landing that fix. It is about making the next such change cheap to **apply and inspect** across already-detected volumes.

**Depends on:** `modularize-panel-detect` §0 (the `assignReadingOrder` test baseline) — already merged.

## What Changes

- **Persist raw detector output.** Add a `raw_panels_json` column to `panel_data` holding the unordered `RawPanel[]` straight from the detector, alongside the existing ordered `panels_json` / `reading_tree_json`. Detection writes it once; ordering is a derived view.

- **Make ordering a pure re-runnable stage.** Introduce a single `orderPage(rawPanels, config?)` entry that wraps `assignReadingOrder` and is the only thing that reads `raw_panels_json` and writes `panels_json` + `reading_tree_json`. The detection path (`job-manager.ts`, `/api/panel-detect/route.ts`) calls detection → `orderPage` → store, persisting both raw and ordered.

- **Add a re-order action that skips detection.** New admin capability + endpoint: re-run ordering for a volume (or single page) using stored `raw_panels_json`, with no ML inference. This is what makes ordering-algorithm iteration cheap — change the algorithm, re-order the corpus, eyeball the results in the existing `/admin/panel-detect` UI.

- **Validate ordering changes on real volumes.** The re-order action is how an ordering change (like the XY-cut fix already on `main`) gets applied to the existing corpus and eyeballed in `/admin/panel-detect` — cheaply, with no re-detection. Landing further algorithm fixes is *not* part of this change; each such fix is its own change, developed and pinned against the §0 baseline. This change provides the mechanism to apply and inspect them.

- **Backfill path for existing data.** Rows written before this change have no `raw_panels_json`. The re-order action skips such rows (or reports them as "needs detection"); a volume can be re-detected once to populate raw panels going forward. No destructive migration of existing ordered data.

Out of scope (deferred):

- Per-series ordering config / tuning UI. The config object lands in `modularize-panel-detect` Step 1; exposing it per-series is a later change.
- Changing the detector itself or its thresholds — detection output is treated as fixed here.
- Ordering-algorithm fixes themselves — each is its own change, pinned by the §0 baseline. This change only makes them cheap to apply to stored volumes.
- Caching strategy beyond the storage column (e.g. invalidation hooks). Re-order is an explicit action, not an automatic reaction to algorithm changes.

## Capabilities

### Modified Capabilities

- `panel-data-storage` — adds `raw_panels_json` to the `panel_data` table and an idempotent re-order operation that derives ordered panels from stored raw panels without re-detection.
- `panel-detection` — ordering is a separately-invokable stage over stored raw panels; detection persists raw output. (Ordering output itself is unchanged by *this* change — the XY-cut fix already landed separately.)

### New Capabilities

- None. (The re-order endpoint and admin control extend existing `panel-data-storage` / `panel-detection-ui` surfaces.)

## Impact

- **Code**
  - Touched: `src/lib/db.ts` (add `raw_panels_json` column via schema-migration block), `src/lib/panel-data.ts` (read/write raw panels; re-order query), `src/lib/panel-detect/job-manager.ts` and `src/app/api/panel-detect/route.ts` (persist raw + ordered). `reading-order.ts` is **not** touched here — it is consumed as-is via `orderPage`.
  - New: an `orderPage` entry point (likely `src/lib/panel-detect/order.ts`), a re-order API route under `src/app/api/panel-data/`, an admin re-order control in `src/app/admin/panel-jobs/page.tsx` (or the panel-detect admin page).
  - Tests: round-trip coverage for raw-panel persistence and the re-order action. The §0 ordering fixtures are unchanged by this change.
- **Dependencies**: none added.
- **APIs / contracts**: new re-order endpoint; `panel_data` gains a nullable `raw_panels_json` column (additive, backward-compatible). Existing read APIs unchanged in shape.
- **Operational**: one-shot additive column migration on next boot. Pre-existing rows keep working in read paths; they simply can't be re-ordered until re-detected once.
- **Risk**: low. The change is pure plumbing — an additive nullable column plus a re-order action that routes stored raw panels through the existing, already-tested `assignReadingOrder`. No ordering behaviour changes here (the §0 snapshot must stay green throughout), so there is no algorithm-regression surface; the main risks are migration correctness and the re-order/skip accounting, both covered by round-trip verification.
