## 1. Database schema and migration

- [ ] 1.1 In `src/lib/db.ts`, add `kind TEXT NOT NULL DEFAULT 'volume'` column to the `series` table CREATE statement.
- [ ] 1.2 Add an idempotent migration block that adds the `kind` column to existing `series` rows via `ALTER TABLE series ADD COLUMN kind ...` guarded by a `pragma table_info` check.
- [ ] 1.3 Update the `volumes` CREATE TABLE statement to be `reading_units` with column `unit_number` (was `volume_number`) and the same remaining columns.
- [ ] 1.4 Add an idempotent migration that, if the `volumes` table still exists, creates `reading_units`, copies rows (`INSERT INTO reading_units (id, series_id, title, filename, unit_number, page_count, format, created_at) SELECT id, series_id, title, filename, volume_number, page_count, format, created_at FROM volumes`), then drops `volumes`. Preserve primary key values.
- [ ] 1.5 Update CREATE TABLE statements for `reading_progress`, `panel_data`, and `panel_queue_items` to reference `unit_id` instead of `volume_id`.
- [ ] 1.6 Add idempotent migrations that rename `volume_id` to `unit_id` in `reading_progress`, `panel_data`, and `panel_queue_items` via `ALTER TABLE ... RENAME COLUMN ...`, guarded by `pragma table_info` checks.
- [ ] 1.7 Update the unique constraint on `reading_progress` (`UNIQUE(profile_id, volume_id)` → `UNIQUE(profile_id, unit_id)`) and the unique constraint on `panel_data` (`UNIQUE(volume_id, page_number)` → `UNIQUE(unit_id, page_number)`).
- [ ] 1.8 Update index creation: `idx_volumes_series` → `idx_reading_units_series ON reading_units(series_id)`, `idx_panel_data_volume` → `idx_panel_data_unit ON panel_data(unit_id)`.

## 2. Type definitions

- [ ] 2.1 In `src/types/index.ts`, rename `Volume` interface to `ReadingUnit`; rename field `volume_number` → `unit_number`.
- [ ] 2.2 Add `kind: 'volume' | 'chapter'` to the `Series` interface.
- [ ] 2.3 Rename `ProgressEntry.volume_id` → `ProgressEntry.unit_id`.
- [ ] 2.4 Rename `ProgressEntryWithSeries.volume_title` → `ProgressEntryWithSeries.unit_title`, `volume_number` → `unit_number`. Update any consumers if the field names appear in responses.

## 3. Library helpers and constants

- [ ] 3.1 In `src/lib/db-queries.ts`, rename `getVolume` → `getUnit`, `getVolumesBySeries` → `getUnitsBySeries`. Update SELECT statements to use the new table and column names; include `kind` when selecting series.
- [ ] 3.2 In `src/lib/constants.ts`, rename `STORAGE_KEYS.progress` builder so it produces `progress:{profileId}:{unitId}`. Keep a legacy-builder helper if convenient for the shim.
- [ ] 3.3 In `src/lib/covers.ts` (and any path-builder helpers), change the per-unit thumbnail cache path prefix from `vol-` to `unit-` (both `unit-<filename>.jpg` and `unit-<filename>.cover.jpg`).
- [ ] 3.4 In `src/lib/api-response.ts` and other shared helpers, audit for `volume*` references and rename.

## 4. Scanner

- [ ] 4.1 In `src/lib/scanner.ts`, detect the `chapters/` subfolder (case-insensitive) when iterating series directories.
- [ ] 4.2 When inserting a new series row, set `kind='chapter'` if the chapters subfolder contains at least one supported file; otherwise `kind='volume'`.
- [ ] 4.3 Skip empty `chapters/` folders so that the series row is not materialized when no supported files are present.
- [ ] 4.4 Implement the collision rule: if both flat files and `chapters/` files exist, defer to existing `series.kind` (querying the DB); for brand-new series, prefer flat. Log a warning naming the ignored source.
- [ ] 4.5 Implement kind-branched number extraction. Keep `extractVolumeNumber` unchanged for volume series. Add `extractChapterNumber` that matches `chapter|ch|#|trailing-number`. Branch the call site in the scanner loop based on series kind.
- [ ] 4.6 Update `INSERT INTO volumes` → `INSERT INTO reading_units` and `volume_number` → `unit_number` throughout the scanner.

## 5. Server-side route renames

- [ ] 5.1 Move folder `src/app/read/[seriesId]/[volumeId]/` → `src/app/read/[seriesId]/[unitId]/`. Update internal `params` destructuring (`volumeId` → `unitId`) in the route handler and any nested layouts.
- [ ] 5.2 Move folder `src/app/api/manga/[seriesId]/[volumeId]/` → `src/app/api/manga/[seriesId]/[unitId]/`. Update all nested route files (`pdf`, `thumbnail`, `cover/*`).
- [ ] 5.3 In `src/app/api/progress/route.ts`, rename the `volumeId` query param to `unitId`. Update parsing, response shape, and any SQL bindings.
- [ ] 5.4 Audit `src/app/api/manga/route.ts` and `src/app/api/manga/[seriesId]/route.ts` to ensure they return `kind` on the series payload and use the renamed table/columns.

## 6. localStorage migration shim

- [ ] 6.1 Add a helper that on every read of `progress:{profileId}:{unitId}` also checks the legacy `progress:{profileId}:{volumeId}` key (same numeric id), copies the value to the new key and deletes the legacy key.
- [ ] 6.2 Update the reader's mount logic (where `useMaxOfDbAndLocalStorage` lives) to call the helper, so the legacy key value is considered before the new key on first access.
- [ ] 6.3 Update the debounced-save success handler to delete BOTH the new and legacy keys (legacy may be empty by then, but defensive).

## 7. Reclassify endpoint and UI

- [ ] 7.1 Create `src/app/api/manga/[seriesId]/reclassify/route.ts` (POST). Validate admin context. Look up series; flip `kind` to the opposite; delete all `reading_units` rows for the series; delete associated `reading_progress` rows; return the updated series row. Wrap in a transaction.
- [ ] 7.2 Return 404 if the series does not exist; 403 (or matching gate) if the caller is not admin.
- [ ] 7.3 In `src/app/library/[seriesId]/SeriesClientContent.tsx`, add an admin-only "Reclassify series" button next to "Fetch Metadata" and "Delete Series".
- [ ] 7.4 Add a confirmation dialog that explicitly warns reading progress will be lost and reminds the user to move files between the series root and the `chapters/` subfolder. Send the POST on confirmation.
- [ ] 7.5 After successful reclassify, refresh the series detail page so the kind-aware labels update.

## 8. UI label dispatch by series kind

- [ ] 8.1 In `src/app/library/[seriesId]/SeriesClientContent.tsx`, change the "Volumes" section header and the "X volumes" count to be driven off `series.kind` (kind-aware noun).
- [ ] 8.2 Update `SeriesContinueButton` to render kind-aware continue copy ("Continue Vol. X" vs "Continue Chapter X").
- [ ] 8.3 Update `SeriesProgressBar` if it carries any volume noun; otherwise verify it is already kind-agnostic.
- [ ] 8.4 In `src/components/Reader/*` (end-of-unit overlay), accept the parent series's `kind` as a prop or via the reader's data and render "Continue to Vol. X" or "Continue to Ch. X" accordingly. Same for the start-of-unit overlay ("Go to Vol. X" / "Go to Ch. X").
- [ ] 8.5 In `src/components/Library/ContinueReading.tsx`, render the hero card and horizontal-scroll entries with kind-aware nouns.

## 9. Component renames

- [ ] 9.1 Rename `src/components/Library/VolumeGrid.tsx` → `UnitGrid.tsx`; update exports and consumers.
- [ ] 9.2 Rename `src/components/Library/VolumeThumbnail.tsx` → `UnitThumbnail.tsx`; update exports and consumers.
- [ ] 9.3 Rename `src/components/Library/VolumeProgress.tsx` → `UnitProgress.tsx`; update exports and consumers.
- [ ] 9.4 Search the codebase for any other `Volume*` component, hook, or helper identifiers and rename consistently.

## 10. Cover-art behavior for chapter series

- [ ] 10.1 In the per-unit `cover/generate-web` route handler, look up the parent series. If `series.kind === 'chapter'`, return 400 with a clear message ("per-unit MangaDex covers are only available for volume series").
- [ ] 10.2 In `src/components/Library/CoverMenu.tsx`, disable the "Auto-generate from web" menu item when the rendered tile is a unit in a chapter-series, with an explanatory tooltip.
- [ ] 10.3 In `runBulkCoverFetch` (`SeriesClientContent.tsx`), branch on `series.kind`: for volume series, retain the existing per-unit loop; for chapter series, fetch only the series cover and skip the loop entirely.

## 11. Cleanup of legacy references

- [ ] 11.1 Grep the repo for `volume_id`, `volume_number`, `volumeId`, `VolumeGrid`, `VolumeThumbnail`, `VolumeProgress`, and ensure all references in `src/` are renamed (UI strings shown to users may still say "Volume" when `series.kind === 'volume'`; only identifiers are renamed).
- [ ] 11.2 Audit `src/instrumentation.ts` and any startup paths for stale references.
- [ ] 11.3 Update any test files that mock or reference the old type/column names.

## 12. Verification

- [ ] 12.1 Run `npm run lint` — must pass.
- [ ] 12.2 Run `npm run build` — must compile.
- [ ] 12.3 Run `npm test` — must pass.
- [ ] 12.4 Manual smoke (volume series, existing library):
  - Boot server with an existing `data/manga-reader.db`. Verify migration logs show schema updates without errors.
  - Open the library, navigate into a volume series, open a volume, navigate pages, verify progress persists across reload.
  - Verify "Volumes" header and "X volumes" count appear.
  - Verify end-of-volume overlay says "Continue to Vol. X".
- [ ] 12.5 Manual smoke (chapter series, new):
  - Create `MANGA_DIR/Test Series/chapters/Chapter 001.cbz` (and a few more). Restart server.
  - Verify series shows up with `kind='chapter'` (check DB or UI labels).
  - Verify "Chapters" header and "X chapters" count appear.
  - Open Chapter 001, navigate to last page, verify "Continue to Ch. 2" overlay.
  - Reload the reader on chapter 1, verify resume from saved page.
- [ ] 12.6 Manual smoke (reclassify):
  - On a volume series with reading progress, press "Reclassify series" as admin, confirm. Verify reading_units and reading_progress rows are gone in the DB, series kind flipped, and series detail page now shows "Chapters" with no units (until files are moved).
- [ ] 12.7 Manual smoke (cover-art on chapter series):
  - Open the CoverMenu on a chapter-series unit tile in admin mode. Verify "Auto-generate from web" is disabled with the explanatory tooltip.
  - Run "Fetch Metadata" on a linked chapter series. Verify only the series cover is fetched; the per-unit loop does not run (check network requests or progress indicator).
- [ ] 12.8 Manual smoke (localStorage shim):
  - Before upgrade, force a `progress:{profileId}:{volumeId}` key into localStorage at a specific page (devtools). Upgrade. Open the corresponding unit; verify the reader resumes at the saved page and the legacy key is gone afterwards.

## 13. OpenSpec sync

- [ ] 13.1 Run `openspec validate add-chapter-support` and confirm it passes.
- [ ] 13.2 When implementation is complete and verified, archive the change via `openspec archive add-chapter-support` (or `/opsx:archive`).
