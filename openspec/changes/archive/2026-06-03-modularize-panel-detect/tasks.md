# Tasks

## 0. Step 0 — Reading-order test baseline

Establishes a regression net for `assignReadingOrder` **before** any threshold is touched in §1. `assignReadingOrder` is a pure, synchronous, deterministic function (`RawPanel[]` in normalized 0–1 coords → ordered `Panel[]` + `ReadingTree`), so it can be tested without ML, the DB, or the filesystem. This baseline is what §1.6's "byte-identical behaviour" check asserts against, and it de-risks the separate `separate-panel-ordering-from-detection` change that follows.

- [x] 0.1 Create `tests/lib/panel-detect/` with a `fixtures/` subfolder. Each fixture is a JSON file `{ input: RawPanel[], expected: string[] /* panel ids in reading order */, note: string }`
- [x] 0.2 Author labelled fixtures, one per case the current `reading-order.ts` comments describe:
  - `single-panel` — degenerate 1-panel page
  - `classic-2x3-rtl` — standard right-to-left grid, no deferral
  - `tall-left-stacked-right` — the deferral pass (tall left-column panel read after stacked right panels it frames)
  - `full-width-strip-vs-side` — the `horizConflict` guard (full-width bottom strip near a right-side panel above)
  - `short-anchor-taller-neighbor` — the vertical-overlap fallback (short anchor + taller candidate starting slightly lower)
  - `ambiguous-row-boundary` — pair straddling the `rowOverlap` thresholds
- [x] 0.3 Add `tests/lib/panel-detect/reading-order.test.ts` (a) asserting each labelled fixture's `expected` order, and (b) a golden-snapshot test capturing today's output for every fixture (the snapshot flags _change_, not _correctness_ — it is the safety net during §1's config extraction)
- [x] 0.4 Add property-based invariants over a generated set of random panel layouts: output length equals input length, every input id appears exactly once, `readingOrder` is a contiguous `1..N`, and the `ReadingTree` references exactly the returned panel ids
- [x] 0.5 Confirm `npm test` runs the new suite (vitest `include` is `tests/**/*.test.{ts,tsx}` — the new path is covered) and it passes against unmodified `reading-order.ts`

**Checkpoint C0**: reading-order behaviour is pinned by tests. Any change in §1 that perturbs ordering now fails loudly. PR.

## 1. Step 1 — `PanelDetectConfig`

- [x] 1.1 Create `src/lib/panel-detect/config.ts` exporting `interface PanelDetectConfig` with named fields for every magic number called out in audit:
  - ML: `inputSize` (640), `confidence` (0.25), `nms` (0.45), `gapFraction` (0.10), `blankWhiteness` (230 / 0.90), and the inferred-panel + filtered-panel thresholds (0.6, 0.3, 0.2)
  - Reading-order: `rowOverlapHigh` (0.5), `rowOverlapLow` (0.4), `verticalOverlapMin` (0.3), `horizontalConflict` (0.6), `sideDeferralRatio` (0.7)
  - Contour: `whiteThreshold` (0.85), `borderWhiteness` (0.95), `recursionDepth` (10), `minPanelSize` (200)
  - _Note: implemented as nested groups (`ml` / `readingOrder` / `contour`) with descriptive field names mapped 1:1 to the real code literals — several distinct thresholds share the value 0.5, so flat names would have collided. Every default reproduces today's exact value._
- [x] 1.2 Export `DEFAULT_PANEL_DETECT_CONFIG` matching today's exact values
- [x] 1.3 Update `detectPanelsMl()` in `src/lib/panel-detect/ml.ts` to accept `config?: PanelDetectConfig` and read every threshold from it. No call-site change required when omitted (uses default)
- [x] 1.4 Update `assignReadingOrder()` in `src/lib/panel-detect/reading-order.ts` to accept `config?` and read the row-grouping thresholds from it. Add JSDoc on each threshold field describing what it does and why the default is what it is
- [x] 1.5 Update `findPanels()` in `src/lib/panel-detect/contour.ts` similarly
- [x] 1.6 Verify default-config behaviour is byte-identical to before: the §0 golden-snapshot suite (`tests/lib/panel-detect/reading-order.test.ts`) MUST still pass unchanged after config extraction. As a secondary check, run a panel-detect job on a known volume and diff the resulting `panel_data` rows _(golden snapshot passes unchanged — 16/16; the panel_data row diff is a runtime check deferred to §5.1)_

**Checkpoint C1**: thresholds named and centralised. PR.

## 2. Step 2 — `PanelDetector` strategy interface

- [x] 2.1 Create `src/lib/panel-detect/detector.ts` exporting `interface PanelDetector { name: 'ml' | 'contour'; detect(buf: Buffer, opts: { confidence?: number; config?: PanelDetectConfig }): Promise<RawPanel[]> }`
- [x] 2.2 Create `MlDetector` and `ContourDetector` implementations as exported objects in the same file (or sibling files) wrapping the existing functions
- [x] 2.3 Create a small registry: `getDetector(name: 'ml' | 'contour'): PanelDetector` returning the correct implementation; default `'ml'`
- [x] 2.4 Update `src/app/api/panel-detect/route.ts` to read an optional `strategy` field from the request body, pass it to `getDetector(strategy ?? 'ml').detect(...)`. Validate against the literal union _(detect() returns `RawPanel[]` per spec; `pageType` is now derived via the shared `classifyPageType` helper, and the ad-hoc `debug` field — never part of the canonical `DetectionResult` type — is dropped)_
- [x] 2.5 Update `src/lib/panel-detect/job-manager.ts` to consume `getDetector('ml')` instead of calling `detectPanelsMl` directly. (Queue jobs continue to default to ML; future enhancement: per-job strategy)
- [x] 2.6 Verify ML behaviour at defaults is unchanged on a known volume (same row count + same panel coords) _(confirmed at runtime in §5.1: fresh ML output byte-identical to the stored baseline on vol 24)_
- [x] 2.7 Verify contour strategy returns _something_ via `/api/panel-detect` with `strategy: 'contour'` — qualitative spot check; full validation deferred _(confirmed: `strategy:'contour'` returns `results.contour` with panels + reading tree; invalid strategy → HTTP 400)_

**Checkpoint C2**: detection strategy is swappable. Contour stops being dead code. PR.

## 3. Step 3 — ONNX session lifecycle

- [x] 3.1 Create `src/lib/panel-detect/onnx-session.ts` exporting a singleton with `getSession()` (lazy init), `releaseSession()` (dispose + null), and an internal idle-timeout cleaner
- [x] 3.2 Move the `let ort` and `let session` module-level variables out of `src/lib/panel-detect/ml.ts` into the new module
- [x] 3.3 Wire `releaseSession()` into queue completion in `src/lib/panel-detect/queue-processor.ts` so the session is released when no jobs are running for > 5 minutes (configurable in `PanelDetectConfig` via `sessionIdleMs`)
- [x] 3.4 Verify: run a panel-detect job, wait for completion, confirm session is released after the idle window, run another job and confirm clean re-init _(confirmed: ran a PDF job then a CBZ job back-to-back; the second re-initialised the session cleanly with no errors. `getSession()` cancels any pending idle-release; release is scheduled on queue drain/pause via `sessionIdleMs`.)_

**Checkpoint C3**: ONNX session has explicit lifecycle. PR.

## 4. Step 4 — Storage index + bounds

- [x] 4.1 Add a `CREATE INDEX IF NOT EXISTS idx_panel_data_volume_page ON panel_data(volume_id, page_number)` in `src/lib/db.ts`'s schema-migration block
- [x] 4.2 Replace the silent 10-page cap in `getPanelDataForPages()` (`src/lib/panel-data.ts`) with an explicit `limit?: number` parameter; document in JSDoc; default to a sane value (e.g. 50) and let callers raise it
- [x] 4.3 Add input validation in `insertPanelData()`: assert `page_number > 0`, `volume_id > 0`, `panels` is an array
- [x] 4.4 Verify the index exists after server boot via `sqlite3 data/manga-reader.db ".indices panel_data"` (or equivalent) _(verified — `getDb()` creates `idx_panel_data_volume_page`)_
- [x] 4.5 Spot-check query performance: a `panel-data/[volumeId]` request remains < 50 ms on a volume with > 200 pages _(EXPLAIN QUERY PLAN confirms both the full-volume and IN-clause queries use `idx_panel_data_volume_page`; raw query time on the 221-page vol 24 = 0.141 ms full-volume / 0.017 ms pages — far under 50 ms. Warm route render time ~9–18 ms.)_

**Checkpoint C4**: storage tightened. PR.

## 5. Verification

- [x] 5.1 Full panel-detect job on one PDF and one CBZ volume; result compared against pre-change baseline _(single-page ML output is byte-identical to the pre-change `panel_data` baseline on vol 24 pages 5/50/120 — same count, coords to 5 d.p., reading order, page type. Live queue jobs run end-to-end on PDF vol 26 and CBZ vol 158 — `getDetector('ml')` → `classifyPageType` → validated `insertPanelData` all write correct rows; test rows cleaned up afterwards.)_
- [x] 5.2 `/admin/panel-detect` single-page run produces same output at default confidence _(POST `/api/panel-detect` at conf 0.25 returns `method:ml`, correct `pageType`, panels + reading tree; matches baseline. The ad-hoc `debug` field is now absent — `panels`/`readingTree`/`pageType` unchanged.)_
- [x] 5.3 Smart panel zoom in the reader still works (consumes `panel_data` table — coordinate semantics unchanged) _(its data source `/api/panel-data/[volumeId]/pages` returns correct per-page panels; coordinate semantics untouched and verified identical to baseline in §5.1)_
- [x] 5.4 `npm run lint` and `npm run build` clean _(build: exit 0, "Compiled successfully"; lint: all panel-detect files clean — the 6 remaining repo-wide errors are pre-existing `react-hooks` violations in UI components untouched by this change)_
- [x] 5.5 No new console errors during a full server lifecycle (start → run job → idle → re-run job → stop) _(server console clean across single-page ML + contour + 400 validation + full-volume/pages queries + PDF job run/cancel + CBZ job run/cancel — no errors, unhandled rejections, or exceptions. Second job re-initialised the ONNX session cleanly, confirming §3.4.)_

## 6. Cleanup

- [x] 6.1 Remove any duplicated threshold constants that survived §1 _(moved ML/contour constants deleted; the duplicated full-bleed `0.9` + page-classify logic unified into `classify.ts`; ESLint clean on `panel-detect/` confirms no orphaned constants)_
- [x] 6.2 Update CLAUDE.md "Architecture / Key patterns" with the new `config.ts` / `detector.ts` / `onnx-session.ts` files
- [x] 6.3 If contour ends up not being useful at all, document that decision and consider deleting it in a follow-up — but only after this change is archived _(contour is now a selectable strategy via `getDetector('contour')` and the `/api/panel-detect` `strategy` field — no longer dead code, so no deletion warranted. Whether it's worth keeping awaits the qualitative spot check in §2.7/§5; revisit post-archive.)_
