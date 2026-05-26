### Requirement: Admin can search MangaDex for series metadata
The system SHALL provide an API endpoint that searches MangaDex by series title and returns the top matching candidates including title, description, author, and MangaDex ID.

#### Scenario: Successful search returns candidates
- **WHEN** an admin sends `GET /api/manga/[seriesId]/metadata/search`
- **THEN** the system queries MangaDex with the series title and returns up to 5 candidate results, each containing `mangadexId`, `title`, `description`, and `author`

#### Scenario: MangaDex API is unreachable
- **WHEN** an admin sends `GET /api/manga/[seriesId]/metadata/search` and MangaDex cannot be reached
- **THEN** the system returns a 502 error with a human-readable message

#### Scenario: No matches found
- **WHEN** an admin sends `GET /api/manga/[seriesId]/metadata/search` and MangaDex returns zero results
- **THEN** the system returns an empty candidates array and a 200 status

### Requirement: Admin can save fetched metadata to a series
The system SHALL provide an API endpoint that persists a chosen set of metadata fields (`description`, `author`, `mangadex_id`) to the series record in SQLite. After a successful metadata save, the client SHALL trigger a bulk cover-fetch operation that updates the series cover and fills the `.cover.jpg` override for every volume in the series that does not already have a manual-override cover.

#### Scenario: Metadata saved successfully
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` with a valid body containing `description`, `author`, and `mangadexId`
- **THEN** the system updates the series row in SQLite and returns 200 with the updated series data

#### Scenario: Series not found
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` for a series ID that does not exist
- **THEN** the system returns a 404 error

#### Scenario: Bulk cover fetch follows successful save
- **WHEN** the metadata save succeeds and the saved `mangadexId` is non-null
- **THEN** the client sequentially invokes `POST /api/manga/[seriesId]/cover/generate-web` and, for each volume in the series, `POST /api/manga/[seriesId]/[volumeId]/cover/generate-web`

#### Scenario: Bulk cover fetch preserves manual overrides
- **WHEN** the bulk cover fetch encounters a volume with an existing `.cover.jpg` override file
- **THEN** the per-volume `cover/generate-web` request short-circuits server-side without contacting MangaDex, leaving the override unchanged

#### Scenario: Bulk cover fetch failure does not roll back metadata
- **WHEN** any individual cover fetch fails (MangaDex unreachable, no matching cover, etc.)
- **THEN** the metadata remains saved, the failed cover is logged, and the bulk operation continues with the remaining volumes

### Requirement: Series detail page displays metadata when available
The system SHALL render description and author on the series detail page when those fields are present on the series record.

#### Scenario: Series has description and author
- **WHEN** a user visits `/library/[seriesId]` for a series that has description and author stored
- **THEN** the page displays the description text and the author name

#### Scenario: Series has no metadata
- **WHEN** a user visits `/library/[seriesId]` for a series with no metadata
- **THEN** the page renders normally without description or author sections

### Requirement: Fetch Metadata button is visible in admin mode only
The system SHALL display a "Fetch Metadata" button on the series detail page exclusively when admin mode is active.

#### Scenario: Admin mode active
- **WHEN** an admin visits `/library/[seriesId]` with admin mode enabled
- **THEN** a "Fetch Metadata" button is visible on the page

#### Scenario: Admin mode inactive
- **WHEN** a regular user visits `/library/[seriesId]`
- **THEN** no "Fetch Metadata" button is rendered

### Requirement: Fetch Metadata flow presents a preview before saving
The system SHALL show the top MangaDex search result to the admin for confirmation before persisting any data. After confirmation, the same flow SHALL initiate the bulk cover fetch described above without requiring an additional user action.

#### Scenario: Admin confirms the match
- **WHEN** an admin clicks "Fetch Metadata", reviews the preview, and confirms
- **THEN** the system saves the metadata, the page updates to display the new description and author, and the bulk cover fetch begins automatically

#### Scenario: Admin dismisses the preview
- **WHEN** an admin clicks "Fetch Metadata" but dismisses the preview without confirming
- **THEN** no data is saved, the series record is unchanged, and no cover fetch is triggered
