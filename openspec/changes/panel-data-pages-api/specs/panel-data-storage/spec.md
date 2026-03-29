## ADDED Requirements

### Requirement: Batch page query function
The data layer SHALL provide a `getPanelDataForPages(volumeId: number, pageNumbers: number[]): PanelDataPage[]` function that retrieves panel data for multiple specific pages in a single SQL query.

#### Scenario: Query with valid page numbers
- **WHEN** `getPanelDataForPages` is called with a volume ID and an array of page numbers
- **THEN** the function SHALL execute a single SQL query with `WHERE volume_id = ? AND page_number IN (...)` and return results ordered by page number

#### Scenario: Empty page numbers array
- **WHEN** `getPanelDataForPages` is called with an empty array
- **THEN** the function SHALL return an empty array without executing a query
