## 1. Tranche A — pure logic, no harness

- [x] 1.1 Add `tests/lib/panel-detect/classify.test.ts` covering blank / full-bleed / cover / panels and the area-threshold boundary
- [x] 1.2 Add `tests/lib/mangadex.test.ts` driving `searchManga` with a mocked `fetch` (mirroring `mangadex-covers.test.ts`), covering English-or-first title selection, author/artist de-duplication, and missing `attributes.name`
- [x] 1.3 In the same test, assert the outgoing request carries `order[relevance]=desc` (the param the "Fix MangaDex search ranking" commit added) so the ranking fix can't silently regress
- [x] 1.4 Add `tests/lib/api-response.test.ts` covering `parseJsonBody` returning `null` on a malformed body
- [x] 1.5 Add `tests/lib/panel-data.test.ts` covering the `insertPanelData` validation guards (invalid volumeId, pageNumber, non-array panels) — guards only, no DB
- [x] 1.6 Review `tests/lib/reader-settings.test.ts`; add any missing cases for malformed JSON and the reading-direction fallback precedence — already covered, no additions needed

## 2. Tranche B — behavior-preserving extractions + tests

- [x] 2.1 Extract the panel-zoom geometry from `MangaReader.tsx` into `src/lib/reader/panel-zoom.ts` as a pure function; update the call site to import it
- [x] 2.2 Verify reader behavior is unchanged via `npm run build` (passes) and a manual smoke of smart-panel-zoom — function body moved byte-identical; geometry tests pass
- [x] 2.3 Add `tests/lib/reader/panel-zoom.test.ts` with fixture rows for single-stop, multi-stop count, and zoom-cap cases
- [x] 2.4 Extract the nulls-last volume-ordering comparator from `queue-processor.ts` into a pure exported helper; update `create` to use it
- [x] 2.5 Add a test for the comparator covering ascending numeric order with nulls last
- [x] 2.6 Add `export` to the contour helpers (`findGutters`, `horizontalProjection`, `verticalProjection`, `findPanels`) in `src/lib/panel-detect/contour.ts`
- [x] 2.7 Add `tests/lib/panel-detect/contour.test.ts` over synthetic pixel buffers: gutter detection, edge-margin exclusion, two-panel split — no `sharp`

## 3. Tranche C — harness-backed tests

- [x] 3.1 Add an in-memory SQLite test helper that builds the `panel_queue` / `panel_queue_items` (and any referenced) tables from the runtime schema, plus mocks for `jobManager` and the ONNX session helpers — schema extracted to exported `SCHEMA_SQL`; hoisted mocks + per-test `:memory:` DB + `resetModules` for a fresh singleton
- [x] 3.2 Add `tests/lib/panel-detect/queue-processor.test.ts` covering `restoreFromDb` (running→pending, force paused)
- [x] 3.3 Extend the queue-processor test with `cancel` (running→cancelled, pending→skipped) and the second-active-queue rejection in `create`
- [x] 3.4 Extend the queue-processor test with lifecycle guards (`pause`/`resume`/`cancel` throw on wrong state)
- [x] 3.5 Add `tests/lib/gdrive/download-manager.test.ts` covering manifest load with a missing file and with corrupt JSON, each resolving to a default — hardened `loadManifest` to catch corrupt JSON (returns default)

## 4. Documentation & verification

- [x] 4.1 Record the non-goal / intentionally-excluded-modules list in the change (design.md already drafts it; confirm it stays accurate to the final code) — confirmed accurate; `db.ts` remains excluded even after the `SCHEMA_SQL` extraction
- [x] 4.2 Run `npm test` (all green — 104 tests) and `npm run build` (compiles); lint clean on all edited files (pre-existing errors live only in untouched components)
