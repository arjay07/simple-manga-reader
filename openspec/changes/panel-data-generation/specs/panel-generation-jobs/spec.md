## ADDED Requirements

### Requirement: Start a panel generation job
The system SHALL expose `POST /api/panel-jobs` to start a new panel generation job for a specified volume. The request body SHALL include `volumeId` and optionally `confidenceThreshold` (default 0.25).

#### Scenario: Successful job start
- **WHEN** a POST request is made with a valid `volumeId` and no job is currently running
- **THEN** the system SHALL start processing all pages in the volume, return the job status with a 202 status code, and begin background processing

#### Scenario: Job already running
- **WHEN** a POST request is made while another job is already running or paused
- **THEN** the system SHALL return a 409 Conflict error with a message indicating a job is already active

#### Scenario: Invalid volume
- **WHEN** a POST request is made with a non-existent volume ID
- **THEN** the system SHALL return a 404 error

### Requirement: Skip already-processed pages
The job engine SHALL skip pages that already have panel data in the `panel_data` table, unless a `force` flag is set in the job start request.

#### Scenario: Resuming a partially completed volume
- **WHEN** a job is started for a volume where pages 1-47 already have panel data
- **THEN** the job SHALL skip pages 1-47 and begin processing from page 48

#### Scenario: Force re-generation
- **WHEN** a job is started with `force: true`
- **THEN** existing panel data for the volume SHALL be deleted before processing begins

### Requirement: Job progress polling
The system SHALL expose `GET /api/panel-jobs/current` that returns the current job status.

#### Scenario: Job in progress
- **WHEN** a job is running
- **THEN** the response SHALL include `status` ("running"), `volumeId`, `totalPages`, `processedPages`, `currentPage`, `startedAt`, `pagesPerSecond`, and a `pages` array with per-page summaries (page number, panel count, page type, processing time) for already-processed pages

#### Scenario: Job paused
- **WHEN** a job is paused
- **THEN** the response SHALL include `status` ("paused") with the same fields as a running job

#### Scenario: Job completed
- **WHEN** the most recent job has completed
- **THEN** the response SHALL include `status` ("completed") with final totals and the full pages summary

#### Scenario: No job
- **WHEN** no job has been started since server boot
- **THEN** the response SHALL return `status` ("idle") with no job details

### Requirement: Pause a running job
The system SHALL expose `POST /api/panel-jobs/current/pause` to pause the currently running job.

#### Scenario: Successful pause
- **WHEN** a pause request is made while a job is running
- **THEN** the job SHALL stop processing after the current page completes, and the status SHALL change to "paused"

#### Scenario: Pause when not running
- **WHEN** a pause request is made but no job is running
- **THEN** the system SHALL return a 409 error

### Requirement: Resume a paused job
The system SHALL expose `POST /api/panel-jobs/current/resume` to resume a paused job.

#### Scenario: Successful resume
- **WHEN** a resume request is made while a job is paused
- **THEN** the job SHALL continue processing from where it left off, and the status SHALL change to "running"

#### Scenario: Resume when not paused
- **WHEN** a resume request is made but no job is paused
- **THEN** the system SHALL return a 409 error

### Requirement: Cancel a job
The system SHALL expose `POST /api/panel-jobs/current/cancel` to cancel the active job (whether running or paused).

#### Scenario: Successful cancellation
- **WHEN** a cancel request is made while a job is running or paused
- **THEN** the job SHALL stop after the current page completes, the status SHALL change to "idle", and already-processed pages SHALL retain their data in the database

#### Scenario: Cancel when idle
- **WHEN** a cancel request is made but no job is active
- **THEN** the system SHALL return a 409 error

### Requirement: Job error handling
The system SHALL handle errors during page processing gracefully.

#### Scenario: Single page fails
- **WHEN** panel detection fails for a specific page (e.g., corrupt PDF page)
- **THEN** the job SHALL log the error, skip that page, record it as an error in the pages summary, and continue processing the next page

#### Scenario: Fatal error
- **WHEN** a non-recoverable error occurs (e.g., PDF file missing)
- **THEN** the job SHALL stop, set status to "error" with an error message, and retain any already-processed page data

### Requirement: Admin panel generation page
The system SHALL provide an admin page at `/admin/panel-jobs` for managing panel data generation.

#### Scenario: Page layout
- **WHEN** a user navigates to `/admin/panel-jobs`
- **THEN** the page SHALL display series/volume selectors, a confidence threshold slider, and a "Generate" button

#### Scenario: Progress display during job
- **WHEN** a job is running or paused
- **THEN** the page SHALL display a progress bar showing processed/total pages, the current page number, processing speed (pages/sec), estimated time remaining, and Pause/Cancel buttons

#### Scenario: Completed job display
- **WHEN** a job has completed
- **THEN** the page SHALL show a completion summary and a "View Processed Pages" button

### Requirement: Processed pages preview modal
The admin page SHALL provide a modal to browse through processed pages with panel overlays.

#### Scenario: Opening the modal
- **WHEN** the user clicks "View Processed Pages"
- **THEN** a modal SHALL open showing the first processed page with panel bounding boxes overlaid on the page image

#### Scenario: Navigating between pages
- **WHEN** the modal is open
- **THEN** previous/next buttons SHALL allow navigating between processed pages, fetching the page image and panel data on demand

#### Scenario: Page info display
- **WHEN** a page is shown in the modal
- **THEN** the page type, panel count, and processing time SHALL be displayed below the image
