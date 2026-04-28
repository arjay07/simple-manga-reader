# Tasks

## 1. Step 1 — `PanelDetectConfig`

- [ ] 1.1 Create `src/lib/panel-detect/config.ts` exporting `interface PanelDetectConfig` with named fields for every magic number called out in audit:
  - ML: `inputSize` (640), `confidence` (0.25), `nms` (0.45), `gapFraction` (0.10), `blankWhiteness` (230 / 0.90), and the inferred-panel + filtered-panel thresholds (0.6, 0.3, 0.2)
  - Reading-order: `rowOverlapHigh` (0.5), `rowOverlapLow` (0.4), `verticalOverlapMin` (0.3), `horizontalConflict` (0.6), `sideDeferralRatio` (0.7)
  - Contour: `whiteThreshold` (0.85), `borderWhiteness` (0.95), `recursionDepth` (10), `minPanelSize` (200)
- [ ] 1.2 Export `DEFAULT_PANEL_DETECT_CONFIG` matching today's exact values
- [ ] 1.3 Update `detectPanelsMl()` in `src/lib/panel-detect/ml.ts` to accept `config?: PanelDetectConfig` and read every threshold from it. No call-site change required when omitted (uses default)
- [ ] 1.4 Update `assignReadingOrder()` in `src/lib/panel-detect/reading-order.ts` to accept `config?` and read the row-grouping thresholds from it. Add JSDoc on each threshold field describing what it does and why the default is what it is
- [ ] 1.5 Update `findPanels()` in `src/lib/panel-detect/contour.ts` similarly
- [ ] 1.6 Verify default-config behaviour is byte-identical to before by running a panel-detect job on a known volume and diffing the resulting `panel_data` rows

**Checkpoint C1**: thresholds named and centralised. PR.

## 2. Step 2 — `PanelDetector` strategy interface

- [ ] 2.1 Create `src/lib/panel-detect/detector.ts` exporting `interface PanelDetector { name: 'ml' | 'contour'; detect(buf: Buffer, opts: { confidence?: number; config?: PanelDetectConfig }): Promise<RawPanel[]> }`
- [ ] 2.2 Create `MlDetector` and `ContourDetector` implementations as exported objects in the same file (or sibling files) wrapping the existing functions
- [ ] 2.3 Create a small registry: `getDetector(name: 'ml' | 'contour'): PanelDetector` returning the correct implementation; default `'ml'`
- [ ] 2.4 Update `src/app/api/panel-detect/route.ts` to read an optional `strategy` field from the request body, pass it to `getDetector(strategy ?? 'ml').detect(...)`. Validate against the literal union
- [ ] 2.5 Update `src/lib/panel-detect/job-manager.ts` to consume `getDetector('ml')` instead of calling `detectPanelsMl` directly. (Queue jobs continue to default to ML; future enhancement: per-job strategy)
- [ ] 2.6 Verify ML behaviour at defaults is unchanged on a known volume (same row count + same panel coords)
- [ ] 2.7 Verify contour strategy returns _something_ via `/api/panel-detect` with `strategy: 'contour'` — qualitative spot check; full validation deferred

**Checkpoint C2**: detection strategy is swappable. Contour stops being dead code. PR.

## 3. Step 3 — ONNX session lifecycle

- [ ] 3.1 Create `src/lib/panel-detect/onnx-session.ts` exporting a singleton with `getSession()` (lazy init), `releaseSession()` (dispose + null), and an internal idle-timeout cleaner
- [ ] 3.2 Move the `let ort` and `let session` module-level variables out of `src/lib/panel-detect/ml.ts` into the new module
- [ ] 3.3 Wire `releaseSession()` into queue completion in `src/lib/panel-detect/queue-processor.ts` so the session is released when no jobs are running for > 5 minutes (configurable in `PanelDetectConfig`)
- [ ] 3.4 Verify: run a panel-detect job, wait for completion, confirm session is released after the idle window, run another job and confirm clean re-init

**Checkpoint C3**: ONNX session has explicit lifecycle. PR.

## 4. Step 4 — Storage index + bounds

- [ ] 4.1 Add a `CREATE INDEX IF NOT EXISTS idx_panel_data_volume_page ON panel_data(volume_id, page_number)` in `src/lib/db.ts`'s schema-migration block
- [ ] 4.2 Replace the silent 10-page cap in `getPanelDataForPages()` (`src/lib/panel-data.ts`) with an explicit `limit?: number` parameter; document in JSDoc; default to a sane value (e.g. 50) and let callers raise it
- [ ] 4.3 Add input validation in `insertPanelData()`: assert `page_number > 0`, `volume_id > 0`, `panels` is an array
- [ ] 4.4 Verify the index exists after server boot via `sqlite3 data/manga-reader.db ".indices panel_data"` (or equivalent)
- [ ] 4.5 Spot-check query performance: a `panel-data/[volumeId]` request remains < 50 ms on a volume with > 200 pages

**Checkpoint C4**: storage tightened. PR.

## 5. Verification

- [ ] 5.1 Full panel-detect job on one PDF and one CBZ volume; result compared against pre-change baseline
- [ ] 5.2 `/admin/panel-detect` single-page run produces same output at default confidence
- [ ] 5.3 Smart panel zoom in the reader still works (consumes `panel_data` table — coordinate semantics unchanged)
- [ ] 5.4 `npm run lint` and `npm run build` clean
- [ ] 5.5 No new console errors during a full server lifecycle (start → run job → idle → re-run job → stop)

## 6. Cleanup

- [ ] 6.1 Remove any duplicated threshold constants that survived §1
- [ ] 6.2 Update CLAUDE.md "Architecture / Key patterns" with the new `config.ts` / `detector.ts` / `onnx-session.ts` files
- [ ] 6.3 If contour ends up not being useful at all, document that decision and consider deleting it in a follow-up — but only after this change is archived
