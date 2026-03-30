## ADDED Requirements

### Requirement: Multi-page panel data endpoint
The system SHALL expose `GET /api/panel-data/:volumeId/pages` that returns panel data for a specific set of pages identified by the `pages` query parameter.

#### Scenario: Valid page numbers
- **WHEN** a GET request is made with `?pages=4,5,6`
- **THEN** the response SHALL contain `{ pages: [...] }` with panel data for only the requested page numbers that have data, ordered by page number

#### Scenario: Some pages have no data
- **WHEN** a GET request includes page numbers where some have panel data and some do not
- **THEN** the response SHALL return data only for pages that have panel data, omitting pages without data

#### Scenario: No pages query parameter
- **WHEN** a GET request is made without the `pages` query parameter
- **THEN** the response SHALL return a 400 error with a descriptive message

#### Scenario: Invalid page numbers
- **WHEN** the `pages` parameter contains non-numeric values
- **THEN** the response SHALL ignore non-numeric values and process only valid integers

#### Scenario: Page count limit
- **WHEN** the `pages` parameter requests more than 10 pages
- **THEN** the response SHALL process only the first 10 page numbers

#### Scenario: Non-existent volume
- **WHEN** a GET request is made for a volume ID that does not exist
- **THEN** the response SHALL return a 404 error

### Requirement: Data layer batch page query
The system SHALL provide a `getPanelDataForPages(volumeId, pageNumbers[])` function that queries the `panel_data` table for specific page numbers using a single SQL query with an `IN (...)` clause.

#### Scenario: Batch query returns matching rows
- **WHEN** `getPanelDataForPages` is called with page numbers `[4, 5, 6]` and pages 4 and 6 have data
- **THEN** the function SHALL return an array of `PanelDataPage` objects for pages 4 and 6, ordered by page number

#### Scenario: No matching rows
- **WHEN** `getPanelDataForPages` is called with page numbers that have no panel data
- **THEN** the function SHALL return an empty array

### Requirement: Two-phase panel data loading
When smart panel zoom is enabled, the reader SHALL use a two-phase fetch strategy: Phase 1 fetches panel data for the current page and its neighbors immediately, and Phase 2 fetches the full volume data in the background.

#### Scenario: Phase 1 immediate fetch
- **WHEN** smart panel zoom is enabled and the reader mounts
- **THEN** the reader SHALL fetch panel data for pages `[currentPage - 1, currentPage, currentPage + 1]` via the multi-page endpoint and set `hasPanelData` to true if any data is returned

#### Scenario: Phase 2 background fetch
- **WHEN** Phase 1 completes
- **THEN** the reader SHALL fetch the full volume panel data in the background and merge it into the panel data map

#### Scenario: On-navigate refetch
- **WHEN** the user navigates to a new page and the full volume data has not yet loaded and any of `[currentPage - 1, currentPage, currentPage + 1]` are missing from the panel data map
- **THEN** the reader SHALL fetch the missing pages via the multi-page endpoint and merge them into the map
