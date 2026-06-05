## Why

Panel detection has two distinct stages with wildly different costs and stability:

1. **Detection** — `detectPanelsMl()` runs a YOLO ONNX model over a page image. Seconds per page, GPU/CPU-bound, effectively a fixed function of the page bitmap.
2. **Ordering** — `assignReadingOrder()` partitions the detected boxes (recursive XY-cut) and assigns RTL manga reading order. Sub-millisecond, pure, and **the part we actually keep changing** (see the history in `src/lib/panel-detect/reading-order.ts`).

Today these stages are fused at the storage layer. `panel_data` persists the *ordered* `Panel[]` (with `readingOrder` baked in) plus the derived `reading_tree_json`, and reads return that stored order verbatim. The consequence: **applying an ordering change to an already-detected 200-page volume requires re-running YOLO over the entire volume**, even though detection output hasn't changed at all.

The key observation that makes this cheap to fix: the geometry already stored in `panels_json` (`x/y/width/height/confidence`) *is* exactly the `RawPanel[]` that ordering consumed at detection time — detection hands those boxes straight to `assignReadingOrder`, which only adds `id`/`readingOrder` and never touches geometry. So the ordering input is already on disk for every page. Reading order can simply be **recomputed from stored geometry on each read**, with no separate raw column, no migration, and no backfill.

**Note:** The first ordering-algorithm fix (recursive XY-cut) and the scored-cut refinement have already landed on `main`, validated against the §0 fixtures. This change is not about landing an algorithm fix — it is about making every such fix reach the *entire stored corpus automatically*, with zero regeneration.

**Depends on:** `modularize-panel-detect` §0 (the `assignReadingOrder` test baseline) — already merged.

## What Changes

- **Derive reading order at read time.** The retrieval functions in `src/lib/panel-data.ts` (`getPanelDataForPage`, `getPanelDataForVolume`, `getPanelDataForPages`) recompute reading order and the reading tree from each row's stored panel geometry via `assignReadingOrder`, instead of returning the stored order verbatim. The stored `readingOrder` / `reading_tree_json` become a non-authoritative snapshot; geometry is the source of truth.

- **No schema change, no migration, no backfill.** `panel_data` is unchanged. Because stored geometry already equals the ordering input, every existing row — old or new — orders correctly under the current algorithm on its next read.

- **Write path untouched.** Detection still stores ordered `panels_json` + `reading_tree_json` exactly as today (it carries the geometry and remains a harmless default); reads simply ignore the stored order and re-derive. No change to `insertPanelData` or `job-manager.ts` is required.

- **Ordering algorithm consumed as-is.** `reading-order.ts` is not modified by this change. `assignReadingOrder` stays the pure core, still pinned by the §0 fixtures + golden snapshot.

- **Effect on iteration.** Change `assignReadingOrder` (or the `readingOrder` config), and the next read of any page reflects it — across all volumes, with no re-detection and no re-order action. Inspect the result directly in `/admin/panel-detect`, which already renders current ordering.

Out of scope (deferred):

- Per-series ordering config / tuning UI. The config object lands in `modularize-panel-detect` Step 1; exposing it per-series is a later change.
- Changing the detector itself or its thresholds — detection output is treated as fixed here.
- Ordering-algorithm fixes themselves — each is its own change, pinned by the §0 baseline. This change only makes them reach stored volumes for free.
- Persisting raw detector output as a distinct column or a materialized re-order action — explicitly rejected in favour of read-time derivation (see `design.md`, Decision 1).

## Capabilities

### Modified Capabilities

- `panel-data-storage` — reads derive reading order from stored panel geometry on each read; stored order is non-authoritative. No schema change.
- `panel-detection` — ordering is a separately-invokable stage that runs over stored panel geometry without re-detection. (Ordering output itself is unchanged by *this* change.)

### New Capabilities

- None.

## Impact

- **Code**
  - Touched: `src/lib/panel-data.ts` (read paths re-derive order; import `assignReadingOrder`).
  - Not touched: `src/lib/db.ts` (no migration), `src/lib/panel-detect/job-manager.ts` and `src/app/api/panel-detect/route.ts` (write path unchanged), `reading-order.ts` (consumed as-is).
  - Tests: round-trip coverage that reads re-derive order from geometry, and that an algorithm/config change is reflected on read without re-insert.
- **Dependencies**: none added.
- **APIs / contracts**: read API response shapes unchanged (`panels`, `readingTree`, …); the values are now derived rather than stored. No schema change.
- **Operational**: none — no migration, no backfill, no new endpoint. Existing volumes pick up ordering changes on next read.
- **Risk**: low. Pure read-path change routing stored geometry through the already-tested `assignReadingOrder`. The only cost is a tiny per-read compute (sub-ms over a handful of panels), acceptable for this self-hosted single-user reader; the §0 snapshot guards ordering behaviour.
