## MODIFIED Requirements

### Requirement: Panel data SQLite table

The system SHALL store panel detection results in a `panel_data` table with columns: `id` (primary key), `volume_id` (FK to volumes), `page_number` (integer), `raw_panels_json` (text, nullable — JSON array of unordered `RawPanel` objects straight from the detector), `panels_json` (text, JSON array of ordered `Panel` objects derived from the raw panels), `reading_tree_json` (text, nullable), `page_type` (text), `processing_time_ms` (integer), `confidence_threshold` (real), and `created_at` (datetime). A UNIQUE constraint SHALL exist on `(volume_id, page_number)`.

`raw_panels_json` is the source of truth for ordering; `panels_json` and `reading_tree_json` are a materialised view of `orderPage(raw_panels_json)`.

#### Scenario: Table created on DB initialization

- **WHEN** the database is first accessed
- **THEN** the `panel_data` table SHALL be created if it does not exist, including the `raw_panels_json` column

#### Scenario: Additive migration for existing rows

- **WHEN** a database created before this change is accessed after upgrade
- **THEN** the `raw_panels_json` column SHALL be added to the existing `panel_data` table and pre-existing rows SHALL have `raw_panels_json` set to `NULL`, with their existing `panels_json` and `reading_tree_json` unchanged

#### Scenario: Detection persists raw and ordered panels

- **WHEN** panel detection completes for a volume/page
- **THEN** the inserted row SHALL contain the unordered detector output in `raw_panels_json` AND the ordered output (derived via `orderPage`) in `panels_json` / `reading_tree_json`

#### Scenario: Idempotent insert

- **WHEN** panel data is inserted for a volume/page combination that already exists
- **THEN** the existing row SHALL be replaced (INSERT OR REPLACE)

## ADDED Requirements

### Requirement: Re-order stored panels without re-detection

The system SHALL be able to recompute reading order for stored panel data by running the ordering stage over `raw_panels_json`, writing fresh `panels_json` and `reading_tree_json`, without invoking the detection model.

#### Scenario: Re-order a fully-detected volume

- **WHEN** a re-order operation is invoked for a volume whose rows all have non-null `raw_panels_json`
- **THEN** every row's `panels_json` and `reading_tree_json` SHALL be recomputed from its `raw_panels_json` via `orderPage`, no detection model inference SHALL run, and the operation SHALL report the count of rows re-ordered

#### Scenario: Re-order skips rows missing raw panels

- **WHEN** a re-order operation encounters a row with `raw_panels_json IS NULL` (written before raw panels were persisted)
- **THEN** that row SHALL be left unchanged and counted in a `skippedNoRaw` total reported to the caller

#### Scenario: Re-order a single page

- **WHEN** a re-order operation is invoked for a specific volume and page number with non-null `raw_panels_json`
- **THEN** only that page's ordered output SHALL be recomputed and persisted

#### Scenario: Re-order is idempotent under an unchanged algorithm

- **WHEN** a volume is re-ordered twice with no change to the ordering algorithm or config
- **THEN** the resulting `panels_json` and `reading_tree_json` SHALL be identical across both runs
