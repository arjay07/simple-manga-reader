# panel-data-storage Specification

## Purpose
TBD - created by archiving change panel-data-generation. Update Purpose after archive.
## Requirements
### Requirement: Panel data SQLite table
The system SHALL store panel detection results in a `panel_data` table with columns: `id` (primary key), `volume_id` (FK to volumes), `page_number` (integer), `panels_json` (text, JSON array of Panel objects — the detected panel set; its geometry `x` / `y` / `width` / `height` / `confidence` is authoritative, while the embedded `readingOrder` is a non-authoritative snapshot recomputed on read), `reading_tree_json` (text, nullable — a non-authoritative snapshot recomputed on read), `page_type` (text), `processing_time_ms` (integer), `confidence_threshold` (real), and `created_at` (datetime). A UNIQUE constraint SHALL exist on `(volume_id, page_number)`.

No raw-panel column is added: the geometry stored in `panels_json` already is the ordering stage's input.

#### Scenario: Table created on DB initialization
- **WHEN** the database is first accessed
- **THEN** the `panel_data` table SHALL be created if it does not exist

#### Scenario: Idempotent insert
- **WHEN** panel data is inserted for a volume/page combination that already exists
- **THEN** the existing row SHALL be replaced (INSERT OR REPLACE)

### Requirement: API to retrieve panel data for a volume
The system SHALL expose `GET /api/panel-data/:volumeId` that returns all stored panel data for a volume, ordered by page number.

#### Scenario: Volume with panel data
- **WHEN** a GET request is made for a volume that has panel data
- **THEN** the response SHALL contain an array of objects with `pageNumber`, `panels`, `readingTree`, `pageType`, and `processingTimeMs` for each processed page

#### Scenario: Volume with no panel data
- **WHEN** a GET request is made for a volume with no stored panel data
- **THEN** the response SHALL return an empty array with a 200 status

#### Scenario: Non-existent volume
- **WHEN** a GET request is made for a volume ID that does not exist
- **THEN** the response SHALL return a 404 error

### Requirement: API to retrieve single page panel data with image
The system SHALL expose `GET /api/panel-data/:volumeId/:page` that returns the stored panel data for a specific page along with the page image re-extracted from the PDF.

#### Scenario: Page with panel data
- **WHEN** a GET request is made for a page that has stored panel data
- **THEN** the response SHALL contain the panel data fields AND a `pageImage` (base64 JPEG), `imageWidth`, and `imageHeight`

#### Scenario: Page without panel data
- **WHEN** a GET request is made for a page that has no stored panel data
- **THEN** the response SHALL return a 404 error

### Requirement: API to check panel data status for a volume
The system SHALL include in the `GET /api/panel-data/:volumeId` response a summary indicating `totalPages` (from the volume), `processedPages` (count of rows in panel_data), and `isComplete` (whether all pages are processed).

#### Scenario: Partially processed volume
- **WHEN** a volume has 120 pages and 47 have panel data
- **THEN** the response SHALL include `totalPages: 120`, `processedPages: 47`, `isComplete: false`

#### Scenario: Fully processed volume
- **WHEN** all pages of a volume have panel data
- **THEN** `isComplete` SHALL be `true`

### Requirement: API to delete panel data for a volume
The system SHALL expose `DELETE /api/panel-data/:volumeId` to remove all stored panel data for a volume.

#### Scenario: Successful deletion
- **WHEN** a DELETE request is made for a volume with panel data
- **THEN** all rows for that volume SHALL be removed and the response SHALL confirm deletion with the count of deleted rows

### Requirement: Reading order is derived at read time

When panel data is read back, the system SHALL recompute reading order and the reading tree from the stored panel geometry via the ordering stage, rather than returning the stored `readingOrder` / `reading_tree_json` verbatim. The stored panel geometry is the source of truth for ordering; no raw-panel column and no re-detection are involved.

#### Scenario: Read recomputes order from geometry

- **WHEN** stored panel data for a page is retrieved (single page, whole volume, or a page set)
- **THEN** the returned panels' `readingOrder` and the returned reading tree SHALL be computed from the stored panel geometry by the ordering stage, and the returned geometry SHALL equal the stored geometry

#### Scenario: Stored order is non-authoritative

- **WHEN** a row's stored `panels_json` contains a `readingOrder` that disagrees with the current ordering algorithm
- **THEN** the read SHALL return the order produced by the current algorithm, not the stored order

#### Scenario: Algorithm change applies without regeneration

- **WHEN** the ordering algorithm or its configuration changes and an already-stored page is subsequently read
- **THEN** the read SHALL return the newly-ordered panels with no re-detection and no rewrite of the stored row

#### Scenario: Empty page

- **WHEN** a stored row has an empty `panels_json`
- **THEN** the read SHALL return zero panels and a `null` reading tree

