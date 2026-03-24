## ADDED Requirements

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
The system SHALL provide an API endpoint that persists a chosen set of metadata fields (`description`, `author`, `mangadex_id`) to the series record in SQLite.

#### Scenario: Metadata saved successfully
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` with a valid body containing `description`, `author`, and `mangadexId`
- **THEN** the system updates the series row in SQLite and returns 200 with the updated series data

#### Scenario: Series not found
- **WHEN** an admin sends `POST /api/manga/[seriesId]/metadata` for a series ID that does not exist
- **THEN** the system returns a 404 error

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
The system SHALL show the top MangaDex search result to the admin for confirmation before persisting any data.

#### Scenario: Admin confirms the match
- **WHEN** an admin clicks "Fetch Metadata", reviews the preview, and confirms
- **THEN** the system saves the metadata and the page updates to display the new description and author

#### Scenario: Admin dismisses the preview
- **WHEN** an admin clicks "Fetch Metadata" but dismisses the preview without confirming
- **THEN** no data is saved and the series record is unchanged
