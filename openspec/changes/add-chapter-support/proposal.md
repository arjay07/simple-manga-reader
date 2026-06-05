## Why

Some manga collections circulate as numbered chapters rather than bound volumes — scanlation releases, ongoing series with no volume-cut yet, or simply user preference. Today the reader only models the "one file = one volume" shape, which forces a chapter-based collection to either be relabeled as fake volumes (lying about the data) or skipped entirely. Adding a per-series "kind" — volume or chapter — lets each series be stored, sorted, labeled, and discussed in the right vocabulary while the underlying file→pages mechanics stay identical.

## What Changes

- **Folder convention (new)**
  - Existing flat layout (`MANGA_DIR/<Series>/<File>.{pdf|cbz}`) continues to mean a volume series.
  - New asymmetric convention: files inside `MANGA_DIR/<Series>/chapters/` (case-insensitive, hardcoded name) mark the series as a chapter series. No symmetric `volumes/` folder — flat is volume.
  - Each series is one kind, fixed when the series row is first created by the scanner.
  - Empty `chapters/` folder does not materialize a series (matches today's behavior for empty folders).
  - **Collision rule**: if both flat files AND `chapters/` files are present, the kind already stored in the DB wins and the other source is logged as a warning. New series with both will use whichever the scanner sees first (flat) and warn.

- **Scanner**
  - Recognizes the `chapters/` subfolder and stamps `kind='chapter'` on first series insertion; flat layouts stamp `kind='volume'`.
  - Number extraction branches by kind:
    - Volume vocab: `vol|v|#|trailing-number` (existing behavior, unchanged).
    - Chapter vocab: `chapter|ch|#|trailing-number`.
  - Subsequent scans never reclassify an existing series — they only add new files within the already-decided kind.

- **Schema (BREAKING)**
  - `ALTER TABLE series ADD COLUMN kind TEXT NOT NULL DEFAULT 'volume'`.
  - **BREAKING**: rename table `volumes` → `reading_units`. Column `volume_number` → `unit_number`. Migration: create new table, copy rows, drop old.
  - **BREAKING**: rename FK column `volume_id` → `unit_id` in `reading_progress`, `panel_data`, `panel_queue_items`.

- **Routes / API / storage (BREAKING URLs)**
  - **BREAKING**: `/read/[seriesId]/[volumeId]` → `/read/[seriesId]/[unitId]`. No redirect — stale bookmarks 404 once.
  - **BREAKING**: `/api/manga/[seriesId]/[volumeId]/*` → `/api/manga/[seriesId]/[unitId]/*` for all sub-routes (pdf stream, thumbnail, cover endpoints).
  - **BREAKING**: `?volumeId=` query param on `/api/progress` → `?unitId=`.
  - **BREAKING**: localStorage key `progress:{profileId}:{volumeId}` → `progress:{profileId}:{unitId}`. Read-side migration shim checks the old key, copies to the new key, deletes the old. Shim is opt-in cleanup later.
  - Thumbnail cache filename `.covers/vol-<filename>.jpg` and override `.covers/vol-<filename>.cover.jpg` → `.covers/unit-<filename>.jpg` and `.covers/unit-<filename>.cover.jpg`. Orphaned `vol-*` files regenerate on next access.

- **Types / components**
  - `Volume` TypeScript type → `ReadingUnit`. Affects `src/types/index.ts` and every consumer.
  - `getVolume`, `getVolumesBySeries` → `getUnit`, `getUnitsBySeries` in `src/lib/db-queries.ts`.
  - `VolumeGrid`, `VolumeThumbnail`, `VolumeProgress` → `UnitGrid`, `UnitThumbnail`, `UnitProgress`.
  - All `volume_id` / `volume_number` references across the codebase are renamed.

- **UI labels (kind-aware)**
  - Series detail header "Volumes" / count "X volumes" become "Chapters" / "X chapters" when `series.kind === 'chapter'`.
  - End-of-unit overlay swaps "Continue to Vol. X" / "Go to Vol. X" / "Series Complete" copy to chapter equivalents.
  - "Continue Reading" hero card and progress bar pluralize on kind.
  - Reader, continue button, and progress aggregation are mechanically identical between kinds — only labels differ.

- **Admin: reclassify**
  - Admin-only "Reclassify series" button on series detail. Confirms reading progress will be lost. Drops `reading_units` rows for the series, flips `series.kind`, prompts the user to also move files in the filesystem before next scan.

- **Cover-art behavior for chapter series**
  - "Fetch Metadata" still fetches series-level metadata (title, description, author, `mangadex_id`) and the series cover from MangaDex.
  - For chapter series, the bulk per-unit cover loop is **skipped** — MangaDex does not serve per-chapter covers. Per-chapter tiles use the existing first-page thumbnail mechanism (now keyed `unit-<filename>.jpg`).
  - Cover-management menu on individual chapter tiles disables the "Auto-generate from web" action (MangaDex per-unit cover endpoint is volume-only and would always 404).

- **Out of scope**
  - A vertical chapter-list view (alternative to the thumbnail grid) for chapter series with many units — defer to a later change.
  - MangaDex chapter→volume mapping to assign parent-volume covers to chapters — explicitly rejected as overkill.
  - Mixing volumes and chapters within a single series — each series is one kind, period.
  - Backwards-compatible redirects from the old `/read/[seriesId]/[volumeId]` URL — self-hosted single-user app; not worth the permanent code.

## Capabilities

### New Capabilities

- `chapter-series-support`: Per-series kind (`volume` | `chapter`) with detection from filesystem layout, kind-aware filename number extraction in the scanner, kind-aware UI label dispatch, admin reclassification flow, and the rule that kind is fixed at series creation. Owns the `chapters/` folder convention and the collision behavior.

### Modified Capabilities

- `progress-resume`: localStorage key prefix and progress API query param rename to use `unitId`. Includes the read-side migration shim that recovers progress saved under the old key.
- `library-progress-ui`: Continue Reading hero card and per-unit progress indicator render kind-aware labels driven off `series.kind`.
- `next-volume-navigation`: Generalize from "next volume" to "next unit". End-of-unit overlay copy and adjacent-unit resolution work for chapter series. Spec renames volume to unit and updates copy variants.
- `cover-art`: Storage paths rename from `vol-` to `unit-`. New behavior: chapter-series per-unit "Auto-generate from web" is disabled (returns 400 with a clear reason). Bulk cover fetch from "Fetch Metadata" branches on series kind.
- `manga-metadata-fetch`: Bulk cover fetch that follows metadata save skips the per-unit loop for chapter series, fetching only the series cover.

## Impact

- **Code**
  - `src/lib/db.ts` — `kind` column on `series`; table+column rename migration; SQLite `ALTER TABLE ... RENAME COLUMN` for FKs.
  - `src/lib/scanner.ts` — detect `chapters/`, set `kind`, branch number extraction.
  - `src/lib/db-queries.ts` — rename query helpers and selected columns.
  - `src/types/index.ts` — `Volume` → `ReadingUnit`; add `kind` to `Series`.
  - `src/lib/constants.ts` — `STORAGE_KEYS.progress` prefix uses `unitId`; bump if needed.
  - `src/lib/covers.ts` and any thumbnail-path builder — `vol-` → `unit-` filename.
  - `src/app/read/[seriesId]/[volumeId]/` → `src/app/read/[seriesId]/[unitId]/` (folder rename).
  - `src/app/api/manga/[seriesId]/[volumeId]/` → `src/app/api/manga/[seriesId]/[unitId]/` (folder rename).
  - `src/app/api/progress/route.ts` — query param rename.
  - `src/app/library/[seriesId]/SeriesClientContent.tsx` — `runBulkCoverFetch` branches on `series.kind`; kind-aware labels; reclassify button.
  - `src/components/Library/Volume*.tsx` — component file renames + label dispatch.
  - `src/components/Reader/*` — end-of-unit overlay copy variants by kind.
  - Anywhere else `volume`/`Volume`/`volume_id`/`volume_number` appears.

- **APIs**
  - All URLs under `/api/manga/[seriesId]/[unitId]/*` are new; old paths return 404.
  - `/api/progress?unitId=` replaces `?volumeId=`.
  - Volume list/detail response shapes include `kind` on series; unit rows expose `unit_number` instead of `volume_number`.
  - New endpoint: `POST /api/manga/[seriesId]/reclassify` (admin only) — drops units, flips kind, returns the updated series.

- **Operational**
  - One-shot DB migration on first boot after upgrade: add `kind` column, build new table, copy rows, rename FK columns.
  - First scan after upgrade picks up any `chapters/` subfolders already present in `MANGA_DIR`.
  - Stale bookmarks to `/read/[seriesId]/[volumeId]` 404 once.
  - Orphaned `vol-<filename>.jpg` thumbnail cache files remain on disk until next access regenerates under `unit-<filename>.jpg`. Manual cleanup is optional.
