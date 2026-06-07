## 1. Schema & types

- [x] 1.1 In `src/lib/db.ts` `SCHEMA_SQL`, add `kind TEXT NOT NULL DEFAULT 'volume'` to the `series` table and change `volumes.volume_number` to `REAL`.
- [x] 1.2 In `getDb()`, add a guarded boot migration (`table_info(series)` check) that runs `ALTER TABLE series ADD COLUMN kind TEXT NOT NULL DEFAULT 'volume'` for existing databases.
- [x] 1.3 Confirm the `volume_number` widening needs no data migration (SQLite per-value affinity); add a brief code comment noting `REAL` holds chapter decimals and existing integers read back identically.
- [x] 1.4 In `src/types/index.ts`, add `kind: 'volume' | 'chapter'` to `Series` (and therefore `SeriesListItem`); keep `volume_number: number | null` (now possibly fractional) and add a short comment.
- [x] 1.5 Update `getSeries` / `getSeriesList` in `src/lib/db-queries.ts` to select `kind`.

## 2. Scanner: detection, paths, chapter numbers

- [x] 2.1 Add `extractChapterNumber(filename)` in `src/lib/scanner.ts` matching `/ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i` with bare-decimal and `#` fallbacks; leave `extractVolumeNumber` unchanged.
- [x] 2.2 In `scanMangaDirectory()`, detect `kind`: a populated `chapters/` subdirectory ⇒ `'chapter'`, else `'volume'`; pass `kind` to the series `INSERT` so it is set only at row creation.
- [x] 2.3 For chapter series, enumerate files from `chapters/` and store each unit's `filename` with the `chapters/` prefix (e.g. `chapters/Ch 10.5.cbz`); for volume series keep flat-file enumeration unchanged.
- [x] 2.4 Select the number extractor by detected kind (`extractChapterNumber` vs `extractVolumeNumber`), falling back to the scan index when none matches.
- [x] 2.5 For a folder with both flat files and a populated `chapters/` dir, use `chapters/`, ignore the flat files, and log a warning.
- [x] 2.6 Verify (manually or via test) that an existing series is never re-kinded on rescan.

## 3. Kind-aware labels

- [x] 3.1 Add a shared label helper (e.g. `src/lib/unit-label.ts`) exposing the long label (`Vol. 3` / `Ch. 10.5`), a short form, and the end-of-unit word (`Volume` / `Chapter`); the volume branch MUST reproduce today's exact strings.
- [x] 3.2 Thread `series.kind` to the components that render unit labels and route them through the helper: `VolumeThumbnail`, `VolumeGrid`, `VolumeProgress`, `EndOfVolumeOverlay`, `ContinueReading`, `SeriesContinueButton`, `MangaReader` (also `SeriesCard` and the series-detail count/heading).
- [x] 3.3 Ensure `ProgressEntryWithSeries` / the progress query carry `kind` so `ContinueReading` can label cross-series entries correctly.
- [x] 3.4 On the series detail page, render chapter-kind series as a vertical list (`ChapterList`) instead of the cover-tile grid; volume-kind series keep `VolumeGrid`.

## 4. Chapter cover behavior

- [x] 4.1 In the bulk cover flow (`SeriesClientContent.tsx` → `runBulkCoverFetch`), gate the per-unit MangaDex loop on `series.kind === 'volume'`; always fetch the whole-series cover.
- [x] 4.2 Confirm chapter units fall back to their page-1 thumbnail with no per-unit MangaDex request.

## 5. Tests & verification

- [x] 5.1 Add a unit test asserting the label helper's volume branch returns the legacy strings (regression guard for "no visual change").
- [x] 5.2 Add tests for `extractChapterNumber` (e.g. `Ch 10.5`, `Chapter 7`, `#3.1`, no-match fallback) and numeric `10 < 10.5 < 11` ordering.
- [x] 5.3 Add a schema/migration test (built from `SCHEMA_SQL`) asserting `series.kind` exists with default `'volume'` and that a `10.5` `volume_number` round-trips.
- [x] 5.4 Add a scanner test covering: `chapters/` ⇒ chapter series with prefixed filenames + decimal numbers; flat ⇒ volume series unchanged; mixed ⇒ chapters win + warning; rescan does not re-kind.
- [x] 5.5 Run `npm run build`, `npm test`, and `npm run lint`; manually confirm an existing volume series renders identically and a sample `chapters/` series reads end-to-end.
