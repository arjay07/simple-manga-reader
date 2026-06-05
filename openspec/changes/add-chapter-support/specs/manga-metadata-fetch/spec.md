## MODIFIED Requirements

### Requirement: Admin can save fetched metadata to a series
The system SHALL provide an API endpoint that persists a chosen set of metadata fields (`description`, `author`, `mangadex_id`) to the series record in SQLite. After a successful metadata save, the client SHALL trigger a bulk cover-fetch operation. The bulk operation behavior depends on the series's `kind`:

- For `kind='volume'` series: fetch the series cover plus a per-unit cover for every reading unit that does not already have a manual-override cover.
- For `kind='chapter'` series: fetch only the series cover; SKIP the per-unit cover loop entirely because MangaDex does not index covers by chapter.

#### Scenario: Metadata saved successfully
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` with a valid body containing `description`, `author`, and `mangadexId`
- **THEN** the system updates the series row in SQLite and returns 200 with the updated series data

#### Scenario: Series not found
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` for a series ID that does not exist
- **THEN** the system returns a 404 error

#### Scenario: Bulk cover fetch follows successful save (volume series)
- **WHEN** the metadata save succeeds for a series with `kind='volume'` and the saved `mangadexId` is non-null
- **THEN** the client sequentially invokes `POST /api/manga/[seriesId]/cover/generate-web` and, for each unit in the series, `POST /api/manga/[seriesId]/[unitId]/cover/generate-web`

#### Scenario: Bulk cover fetch follows successful save (chapter series)
- **WHEN** the metadata save succeeds for a series with `kind='chapter'` and the saved `mangadexId` is non-null
- **THEN** the client invokes `POST /api/manga/[seriesId]/cover/generate-web` once for the series cover and SKIPS the per-unit loop

#### Scenario: Bulk cover fetch preserves manual overrides
- **WHEN** the bulk cover fetch encounters a unit with an existing `.cover.jpg` override file
- **THEN** the per-unit `cover/generate-web` request short-circuits server-side without contacting MangaDex, leaving the override unchanged

#### Scenario: Bulk cover fetch failure does not roll back metadata
- **WHEN** any individual cover fetch fails (MangaDex unreachable, no matching cover, etc.)
- **THEN** the metadata remains saved, the failed cover is logged, and the bulk operation continues with the remaining units (volume series) or completes (chapter series, since there is no remaining work)

### Requirement: Fetch Metadata flow presents a preview before saving
The system SHALL show the top MangaDex search result to the admin for confirmation before persisting any data. After confirmation, the same flow SHALL initiate the bulk cover fetch described above without requiring an additional user action. The kind-aware branching in the bulk fetch is transparent to the user — chapter-series fetches simply finish faster because there is no per-unit loop.

#### Scenario: Admin confirms the match
- **WHEN** an admin clicks "Fetch Metadata", reviews the preview, and confirms
- **THEN** the system saves the metadata, the page updates to display the new description and author, and the bulk cover fetch begins automatically

#### Scenario: Admin dismisses the preview
- **WHEN** an admin clicks "Fetch Metadata" but dismisses the preview without confirming
- **THEN** no data is saved, the series record is unchanged, and no cover fetch is triggered
