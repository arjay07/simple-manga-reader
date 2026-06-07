## MODIFIED Requirements

### Requirement: Admin can save fetched metadata to a series
The system SHALL provide an API endpoint that persists a chosen set of metadata fields (`description`, `author`, `mangadex_id`) to the series record in SQLite. After a successful metadata save, the client SHALL trigger a bulk cover-fetch operation that updates the series cover and, **for volume-kind series only**, fills the `.cover.jpg` override for every volume in the series that does not already have a manual-override cover. For chapter-kind series, the bulk operation SHALL fetch only the whole-series cover and SHALL skip the per-unit MangaDex cover loop, leaving each chapter's cover to its page-1 thumbnail fallback.

#### Scenario: Metadata saved successfully
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` with a valid body containing `description`, `author`, and `mangadexId`
- **THEN** the system updates the series row in SQLite and returns 200 with the updated series data

#### Scenario: Series not found
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` for a series ID that does not exist
- **THEN** the system returns a 404 error

#### Scenario: Bulk cover fetch follows successful save for a volume series
- **WHEN** the metadata save succeeds, the saved `mangadexId` is non-null, and the series `kind` is `'volume'`
- **THEN** the client sequentially invokes `POST /api/manga/[seriesId]/cover/generate-web` and, for each volume in the series, `POST /api/manga/[seriesId]/[volumeId]/cover/generate-web`

#### Scenario: Bulk cover fetch skips the per-unit loop for a chapter series
- **WHEN** the metadata save succeeds, the saved `mangadexId` is non-null, and the series `kind` is `'chapter'`
- **THEN** the client invokes `POST /api/manga/[seriesId]/cover/generate-web` for the whole-series cover only and does NOT issue any per-unit `cover/generate-web` request, so each chapter falls back to its page-1 thumbnail

#### Scenario: Bulk cover fetch preserves manual overrides
- **WHEN** the bulk cover fetch encounters a volume with an existing `.cover.jpg` override file
- **THEN** the per-volume `cover/generate-web` request short-circuits server-side without contacting MangaDex, leaving the override unchanged

#### Scenario: Bulk cover fetch failure does not roll back metadata
- **WHEN** any individual cover fetch fails (MangaDex unreachable, no matching cover, etc.)
- **THEN** the metadata remains saved, the failed cover is logged, and the bulk operation continues with the remaining volumes
