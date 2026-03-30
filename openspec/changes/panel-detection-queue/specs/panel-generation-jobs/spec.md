## MODIFIED Requirements

### Requirement: Admin panel generation page
The system SHALL provide an admin page at `/admin/panel-jobs` for managing panel data generation via a queue-based workflow.

#### Scenario: Page layout
- **WHEN** a user navigates to `/admin/panel-jobs`
- **THEN** the page SHALL display a series selector dropdown, a checkbox list of volumes for the selected series (showing volume title, page count, and whether panel data already exists), a confidence threshold slider, a force re-generate checkbox, and a "Generate Selected" button

#### Scenario: Volume selection
- **WHEN** a series is selected
- **THEN** the page SHALL show all volumes with checkboxes, sorted by volume number, with a "Select All" / "Select None" toggle. Volumes with existing panel data SHALL be visually indicated.

#### Scenario: Starting a queue
- **WHEN** the user checks one or more volumes and clicks "Generate Selected"
- **THEN** the system SHALL create a queue via `POST /api/panel-queue` with the selected volume IDs

#### Scenario: Queue progress display
- **WHEN** a queue is running or paused
- **THEN** the page SHALL display an overall progress bar (volumes completed / total), per-item status indicators (pending, running with page progress, completed, skipped, error), processing speed, ETA, and Pause/Resume/Cancel buttons

#### Scenario: Completed queue display
- **WHEN** a queue has completed
- **THEN** the page SHALL show a completion summary with total volumes processed, total pages, elapsed time, and a "View Processed Pages" button

#### Scenario: Controls disabled during active queue
- **WHEN** a queue is running or paused
- **THEN** the series selector, volume checkboxes, and "Generate Selected" button SHALL be disabled

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

## REMOVED Requirements

### Requirement: Start a panel generation job
**Reason**: Replaced by queue-based workflow. All jobs now go through `POST /api/panel-queue` instead of `POST /api/panel-jobs`.
**Migration**: Use `POST /api/panel-queue` with a single-element `volumeIds` array for single-volume jobs.

### Requirement: Job progress polling
**Reason**: Replaced by `GET /api/panel-queue/current` which returns queue-level and item-level progress.
**Migration**: Use `GET /api/panel-queue/current` instead of `GET /api/panel-jobs/current`.

### Requirement: Pause a running job
**Reason**: Replaced by `POST /api/panel-queue/pause`.
**Migration**: Use `POST /api/panel-queue/pause`.

### Requirement: Resume a paused job
**Reason**: Replaced by `POST /api/panel-queue/resume`.
**Migration**: Use `POST /api/panel-queue/resume`.

### Requirement: Cancel a job
**Reason**: Replaced by `POST /api/panel-queue/cancel`.
**Migration**: Use `POST /api/panel-queue/cancel`.
