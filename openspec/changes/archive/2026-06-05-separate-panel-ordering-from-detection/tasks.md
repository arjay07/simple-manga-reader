# Tasks

> **Prerequisite:** `modularize-panel-detect` §0 (the `assignReadingOrder` test baseline) is merged. The §0 snapshot guards this change from silently altering ordering output. This change does **not** modify the ordering algorithm — it changes only *when* ordering is computed (read time vs. stored).

## 1. Derive reading order at read time

- [x] 1.1 In `src/lib/panel-data.ts`, import `assignReadingOrder` from `./panel-detect/reading-order` and the `RawPanel` type from `./panel-detect/types`.
- [x] 1.2 Add a single row→`PanelDataPage` mapper that parses `panels_json`, passes the parsed panels (typed as `RawPanel[]`) to `assignReadingOrder`, and returns the derived `panels` + `readingTree` (plus `pageNumber`, `pageType`, `processingTimeMs`). The stored `readingOrder` / `reading_tree_json` are ignored on read.
- [x] 1.3 Route `getPanelDataForPage`, `getPanelDataForVolume`, and `getPanelDataForPages` through the mapper so all three reads derive order identically.
- [x] 1.4 Leave the write path (`insertPanelData`, `job-manager.ts`, `/api/panel-detect/route.ts`) and the `panel_data` schema unchanged.

**Checkpoint**: every read returns order derived from stored geometry; no schema or write-path change.

## 2. Tests

- [x] 2.1 Round-trip: insert a row whose stored `panels_json` has a deliberately *wrong* `readingOrder` (scrambled), read it back, and assert the returned panels are ordered by the current algorithm (not the stored order), with geometry preserved.
- [x] 2.2 Algorithm-independence: assert that changing the `readingOrder` config (or stubbing a different ordering) is reflected on the next read of an already-stored row, with no re-insert.
- [x] 2.3 Structural invariants on reads: returned `readingOrder` is contiguous `1..N`, ids are unique, the reading tree references exactly the returned ids; empty `panels_json` yields `[]` panels and a `null` tree.
- [x] 2.4 Existing `panel-data` validation-guard tests stay green.

## 3. Verification

- [x] 3.1 `npm test` green (panel-detect + panel-data suites; §0 snapshot unchanged).
- [x] 3.2 `npm run lint` and `npm run build` clean. (Build clean; lint introduces no new findings — the 6 pre-existing errors / 12 warnings are unchanged from `main` and live in unrelated Reader/GDrive components.)
- [x] 3.3 Manual: open one PDF and one CBZ volume in the reader; confirm smart-panel-zoom navigates the current ordering. On an already-detected volume, tweak the ordering algorithm and confirm the corrected order appears on reload **without** re-running panel generation. *(Verified against the Docker production image.)*

## 4. Cleanup

- [x] 4.1 Update CLAUDE.md "Architecture / Key patterns": note that `panel_data` stores panel geometry and that reading order + reading tree are **derived at read time** from that geometry, so ordering-algorithm changes apply to all volumes with no regeneration.
