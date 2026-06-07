## Why

The reader models every series as a collection of numbered **volumes**, but chapter-based collections (scanlations, uncollected ongoing series) have no volumes — they have chapters, often with decimal numbers (`Ch. 10.5`). Today such series are faked as volumes: mislabeled "Vol. N" and unable to represent `10.5`. We want first-class chapter series without disturbing the existing volume experience.

## What Changes

- **Add `series.kind` (`'volume' | 'chapter'`, default `'volume'`)**, detected once from the filesystem at series-row creation and fixed thereafter: a `chapters/` subdirectory of supported files makes the series a chapter series; flat files keep it a volume series (current behavior).
- **Chapter files store their `chapters/`-prefixed relative path in the existing `filename` column**, so `path.join(MANGA_DIR, folder, filename)` and the thumbnail cache key resolve transparently — file→pages mechanics are byte-identical between kinds; only the scanner learns about `chapters/`.
- **Widen `volumes.volume_number` from `INTEGER` to `REAL`** so chapter numbers like `10.5` sort numerically (`10 < 10.5 < 11`). Existing whole-number values are unaffected (`3 == 3.0`).
- **Decimal-aware chapter number extraction** for chapter series; volume extraction is unchanged.
- **Kind-aware reading-unit labels** ("Vol. 3" vs "Ch. 10.5") across the library and reader, via a shared helper that returns **identical output for `kind='volume'`** — the volume path is the default fall-through and cannot change.
- **Chapter series skip the per-volume MangaDex bulk cover loop** (one series cover + per-chapter page-1 thumbnails only).
- Purely additive: **no** table/column/FK/index renames, **no** URL or route changes, **no** localStorage key changes, **no** reclassify UI. Every existing volume series renders pixel-identical.

## Capabilities

### New Capabilities
- `chapter-series-kind`: Per-series `kind` detected from the filesystem and fixed at creation; chapter files stored under a `chapters/`-prefixed filename; decimal-aware chapter number extraction with numeric (`REAL`) sort; kind-aware reading-unit labels that leave volume output unchanged.

### Modified Capabilities
- `manga-metadata-fetch`: The bulk cover fetch that follows a metadata save SHALL skip the per-volume MangaDex cover loop for chapter-kind series, fetching only the whole-series cover and leaving per-chapter covers to the page-1 thumbnail fallback.

## Impact

- **Schema (`src/lib/db.ts`)**: add `series.kind` and widen `volumes.volume_number` to `REAL` in **both** `SCHEMA_SQL` and the `getDb` boot migration (kept byte-aligned).
- **Scanner (`src/lib/scanner.ts`)**: detect `chapters/`, set `kind`, store chapter `filename` with the `chapters/` prefix, add `extractChapterNumber` (decimal-aware).
- **Types (`src/types/index.ts`)**: add `kind` to `Series`/`SeriesListItem`; `volume_number` becomes `number` (already nullable) representing a possibly-fractional value.
- **Labels**: a shared kind-aware label helper consumed by `VolumeThumbnail`, `VolumeGrid`, `VolumeProgress`, `EndOfVolumeOverlay`, `ContinueReading`, `SeriesContinueButton`, and `MangaReader` — volume rendering unchanged.
- **Covers (`SeriesClientContent.tsx`, `manga-metadata-fetch` flow)**: gate the per-volume cover loop on `kind === 'volume'`.
- **Out of scope**: `volumes`→`reading_units`/`unit_id` rename, URL/route renames, localStorage shim, admin reclassify UI.
