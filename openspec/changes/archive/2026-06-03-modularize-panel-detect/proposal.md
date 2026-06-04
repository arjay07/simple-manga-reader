## Why

The panel-detect subsystem (`src/lib/panel-detect/`) accreted as features landed: ML inference, contour fallback, RTL row-grouping, batch queue, single-page on-demand detection, and per-volume jobs. The audit identified concrete maintainability issues:

- **`ml.ts` (675 lines)** holds module-level mutable state (`let ort`, `let session` at lines 13–14) that is initialised lazily and never cleaned up. It also hard-codes ~9 thresholds (confidence 0.25, NMS 0.45, gap fraction 0.10, blank-region whiteness, etc.) without a config surface, making A/B tuning a code change.
- **`reading-order.ts` (257 lines)** has 5 overlap thresholds (0.5, 0.4, 0.3, 0.6, 0.7) controlling row-grouping and side-deferral. Their interactions are not JSDoc'd; behaviour changes are hard to validate without tests.
- **`contour.ts` (322 lines)** is dead code on the active path: the only API route that runs detection (`/api/panel-detect/route.ts`) hard-codes ML at line 68. Switching detection strategies requires editing the route.
- **`queue-processor.ts` (537 lines) + `job-manager.ts` (263 lines)** rely on a polling pattern (`awaitJobCompletion` busy-loops at 500 ms intervals) and fire-and-forget async loops. Pause/resume is implemented via a busy-loop + resolve callback. There is no structured logging, only `console.error`.
- **`panel-data.ts` (128 lines)** caps `getPanelDataForPages()` at 10 pages silently, JSON-parses on every read, and is missing an index on `(volume_id, page_number)`.

These issues do not block features today, but they make every panel-detection adjustment riskier than it should be — and panel detection is the dependency for the reader's smart-panel-zoom and the cross-page transitions extracted in `decompose-manga-reader`.

## What Changes

A focused modularisation, sequenced behind a test baseline. Steps are independent of each other and independent of the reader/admin tracks.

- **Step 0 — Reading-order test baseline** — before any threshold moves, pin `assignReadingOrder` with tests. It is a pure, deterministic `RawPanel[] → Panel[]` function, so it tests without ML/DB/filesystem. Labelled fixtures cover each case the `reading-order.ts` comments describe (row-grouping, the `horizConflict` guard, the deferral pass, the vertical-overlap fallback); a golden snapshot pins today's output as the safety net for Step 1's config extraction; property-based invariants guard the structural contract. This baseline is also the foundation the follow-on `separate-panel-ordering-from-detection` change relies on to land actual ordering fixes without regressing.

- **Step 1 — `PanelDetectConfig`** — single typed config object holding every threshold currently inlined as a magic number in `ml.ts`, `reading-order.ts`, and `contour.ts`. Default exported from a new `src/lib/panel-detect/config.ts` with sensible defaults; passed through `detectPanelsMl`, `assignReadingOrder`, and `findPanels`. No behavioural change at default values; opens the door to per-series tuning later.

- **Step 2 — `PanelDetector` strategy interface** — new `src/lib/panel-detect/detector.ts`:

  ```ts
  export interface PanelDetector {
    name: 'ml' | 'contour';
    detect(
      buf: Buffer,
      opts: { confidence?: number; config?: PanelDetectConfig },
    ): Promise<RawPanel[]>;
  }
  ```

  ML and contour become two implementations of the interface. The `/api/panel-detect/route.ts` and `job-manager.ts` consume `detector.detect()` rather than calling `detectPanelsMl` directly, with `'ml'` as the default and `'contour'` available as a fallback or admin-toggle. Contour stops being dead code.

- **Step 3 — Decouple ONNX session lifecycle** — replace the module-level `let session` in `ml.ts` with a small `OnnxSessionFactory` (singleton with explicit `init()` / `cleanup()`). Allows the queue processor to release the session when idle for > N minutes, and makes the path serverless-safe should we ever deploy that way. No user-visible change.

- **Step 4 — Index + bounds for panel storage** — add a SQLite index on `panel_data(volume_id, page_number)` via the existing schema-migration block in `src/lib/db.ts`; remove the silent 10-page cap in `getPanelDataForPages()` (or document it as an explicit `limit?` parameter). Validate `page_number` is `> 0` on insert.

Out of scope (deferred):

- **Separating reading-order from detection at the storage layer.** Today `panel_data` stores ordered `Panel[]`, so fixing an ordering bug forces a full ML re-run. Persisting `RawPanel[]` and computing order on read (or via a cheap admin "re-order" action), plus the actual ordering-algorithm fixes, are the subject of the follow-on `separate-panel-ordering-from-detection` change. This change deliberately preserves ordering behaviour (Step 0 pins it); the next change is where it changes.
- Replacing the queue's polling with event emitters. Worth doing later, but costs complexity and is not on the critical path for any current UX issue.
- Structured logging (pino/winston). Worth doing project-wide, not as part of this change.
- Concurrent volume processing. Today the queue serializes one volume at a time; relaxing that requires job-isolation work that isn't justified yet.
- Adding observability metrics.

## Capabilities

### Modified Capabilities

- `panel-detection` — detection strategy is now selected via the `PanelDetector` interface rather than hard-coded; thresholds are configurable. Default behaviour preserved.
- `panel-generation-jobs` — job manager consumes the strategy interface; otherwise unchanged.
- `panel-data-storage` — adds a database index and tightens validation; query API surface unchanged.

### New Capabilities

- None.

## Impact

- **Code**
  - New: `src/lib/panel-detect/config.ts`, `src/lib/panel-detect/detector.ts`, `src/lib/panel-detect/onnx-session.ts`.
  - Touched: `src/lib/panel-detect/ml.ts` (extract config + session), `contour.ts` (implement `PanelDetector`), `reading-order.ts` (accept config), `job-manager.ts` (use strategy), `src/app/api/panel-detect/route.ts` (use strategy), `src/lib/panel-data.ts` (limit param + validation), `src/lib/db.ts` (index migration).
- **Dependencies**: none added.
- **APIs / contracts**: `/api/panel-detect` may accept an optional `strategy: 'ml' | 'contour'` body field; default behaviour preserved if absent.
- **Operational**: one-shot DB migration adds the index on next boot. Existing panel data unaffected.
- **Risk**: low to medium. Step 1 (config) is a lift-and-shift. Step 2 (strategy) requires careful testing that ML behaviour at default config matches today's output exactly. Step 3 (session lifecycle) is straightforward. Step 4 (index) is mechanical.
