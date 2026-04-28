## ADDED Requirements

### Requirement: Panel generation jobs accept any registered volume format

Panel generation jobs SHALL discover page count and per-page images via the format-agnostic page-source abstraction, supporting both PDF and CBZ volumes.

#### Scenario: Starting a job for a CBZ volume

- **WHEN** `POST /api/panel-jobs` is called with a `volumeId` whose `format` is `'cbz'`
- **THEN** the job SHALL initialise `totalPages` from the archive's image-entry count and process pages in natural-sort order

#### Scenario: Resuming a partially completed CBZ volume

- **WHEN** a job is started for a CBZ volume where some pages already have panel data
- **THEN** existing pages SHALL be skipped using the same logic as PDF volumes, and processing SHALL begin from the first un-processed page

#### Scenario: PDF behaviour preserved

- **WHEN** a job is started for a PDF volume
- **THEN** the job SHALL behave identically to before this change

#### Scenario: Page-count caching unaffected by format

- **WHEN** the job manager caches `page_count` on the `volumes` row after first discovery
- **THEN** the cache SHALL be populated for both PDF and CBZ volumes from the page-source abstraction

#### Scenario: Fatal error on missing archive

- **WHEN** a CBZ volume's file has been deleted from disk before the job runs
- **THEN** the job SHALL stop with status `error` and a message indicating the archive was not found, matching the PDF "fatal error" behaviour
