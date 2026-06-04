# Tasks

> **Prerequisite:** `modularize-panel-detect` §0 (the `assignReadingOrder` test baseline) is merged. The §0 snapshot is what guards §1–§2 from silently changing ordering output. This change does **not** modify the ordering algorithm — the XY-cut fix already landed on `main` separately; §3 here just applies it to existing volumes via the new re-order action.

## 1. Step 1 — Persist raw detector output

- [ ] 1.1 Add a nullable `raw_panels_json TEXT` column to `panel_data` via the schema-migration block in `src/lib/db.ts` (additive; pre-existing rows get `NULL`)
- [ ] 1.2 Extend `insertPanelData()` in `src/lib/panel-data.ts` to accept and persist `rawPanels: RawPanel[]` into `raw_panels_json`. Update `PanelDataRow` / `PanelDataPage` types accordingly (expose `rawPanels` on reads where needed)
- [ ] 1.3 Create `src/lib/panel-detect/order.ts` exporting `orderPage(rawPanels: RawPanel[], config?: PanelDetectConfig): { panels: Panel[]; readingTree: ReadingTreeNode | null }` wrapping `assignReadingOrder` — the single producer of ordered output
- [ ] 1.4 Update `src/lib/panel-detect/job-manager.ts`: after `detectPanelsMl`, call `orderPage(detection.panels)` and persist both `detection.panels` (raw) and the ordered result
- [ ] 1.5 Update `src/app/api/panel-detect/route.ts` the same way — persist raw alongside ordered
- [ ] 1.6 Verify the §0 golden snapshot still passes (no ordering change) and that a fresh detect now writes `raw_panels_json`

**Checkpoint S1**: raw panels are stored; ordering routes through `orderPage`. No behaviour change. PR.

## 2. Step 2 — Re-order action (no detection)

- [ ] 2.1 Add `reorderVolume(volumeId, config?)` and `reorderPage(volumeId, pageNumber, config?)` in `src/lib/panel-data.ts` (or `order.ts`): read `raw_panels_json`, run `orderPage`, write `panels_json` + `reading_tree_json`. Skip rows where `raw_panels_json IS NULL` and count them as `skippedNoRaw`
- [ ] 2.2 Add a re-order API route (e.g. `POST /api/panel-data/[volumeId]/reorder`, optional `{ page }` body) returning `{ reordered, skippedNoRaw }`. Use `apiError` / `apiSuccess` helpers
- [ ] 2.3 Add an admin control to trigger re-order for the selected volume in `src/app/admin/panel-jobs/page.tsx` (or the panel-detect admin page), surfacing the `skippedNoRaw` count so missing-raw rows are visible
- [ ] 2.4 Verify: detect a volume, then re-order it — ordered output is identical (algorithm unchanged), `skippedNoRaw` is 0, and no ML inference runs (confirm via timing / no ONNX session activity)
- [ ] 2.5 Verify backfill behaviour: a pre-change volume (NULL raw) reports `skippedNoRaw > 0` and its existing ordered data is untouched

**Checkpoint S2**: ordering is re-runnable from stored raw panels without detection. PR.

## 3. Step 3 — Apply the landed XY-cut fix to existing volumes

> No algorithm work here. The XY-cut reordering fix is already on `main` and pinned by the §0 fixtures. This step uses the §2 re-order action to bring already-detected volumes onto the new ordering and confirm it visually.

- [ ] 3.1 Identify volumes with stored panel data that predate the XY-cut fix (their `panels_json` reflects the old row-grouping order)
- [ ] 3.2 Re-order each via the §2 action (re-detect once first if `raw_panels_json IS NULL`), and spot-check in `/admin/panel-detect` — confirm tall-middle-column and tall-side layouts now read correctly, with no regression on previously-correct pages
- [ ] 3.3 Confirm smart-panel-zoom in the reader navigates the corrected order (it consumes `panels_json` ordering)

**Checkpoint S3**: existing volumes carry the corrected ordering, applied without re-detection. PR.

## 4. Verification

- [ ] 4.1 `npm test` green (extended panel-detect suite)
- [ ] 4.2 `npm run lint` and `npm run build` clean
- [ ] 4.3 Full round-trip on one PDF and one CBZ volume: detect → re-order → reader navigation
- [ ] 4.4 Confirm the additive column migration applied cleanly on boot (`raw_panels_json` present in `panel_data`)

## 5. Cleanup

- [ ] 5.1 Update CLAUDE.md "Architecture / Key patterns" to document the raw/ordered split and the `order.ts` seam
- [ ] 5.2 Note the re-order endpoint in the API routes section of CLAUDE.md
