## ADDED Requirements

### Requirement: Create a panel detection queue
The system SHALL expose `POST /api/panel-queue` to create a new multi-volume queue. The request body SHALL include `seriesId`, `volumeIds` (array of volume IDs to process), and optionally `confidenceThreshold` (default 0.25) and `force` (default false).

#### Scenario: Successful queue creation
- **WHEN** a POST request is made with a valid `seriesId` and at least one `volumeId`, and no queue is currently active
- **THEN** the system SHALL create `panel_queue` and `panel_queue_items` rows in SQLite, begin processing the first volume by `sort_order`, and return the queue state with a 202 status code

#### Scenario: Single volume queue
- **WHEN** a POST request is made with one `volumeId`
- **THEN** the system SHALL create a queue with a single item and process it identically to a multi-volume queue

#### Scenario: Queue already active
- **WHEN** a POST request is made while another queue is running or paused
- **THEN** the system SHALL return a 409 Conflict error

#### Scenario: No volumes specified
- **WHEN** a POST request is made with an empty `volumeIds` array
- **THEN** the system SHALL return a 400 error

### Requirement: Poll queue status
The system SHALL expose `GET /api/panel-queue/current` that returns the current queue state including queue-level status, per-item statuses, and the active volume's page-level progress from `JobManager`.

#### Scenario: Queue running
- **WHEN** a queue is running
- **THEN** the response SHALL include the queue `status`, `seriesId`, `confidenceThreshold`, `items` array (each with `volumeId`, `volumeTitle`, `status`, `totalPages`, `processedPages`, `currentPage`), and overall progress totals

#### Scenario: No active queue
- **WHEN** no queue is active
- **THEN** the response SHALL return `status: "idle"` with no queue details

### Requirement: Pause queue
The system SHALL expose `POST /api/panel-queue/pause` to pause the active queue.

#### Scenario: Successful pause
- **WHEN** a pause request is made while a queue is running
- **THEN** the current volume's processing SHALL pause after the current page completes, and both the queue and current item status SHALL be updated to `paused`

#### Scenario: Pause when not running
- **WHEN** a pause request is made but no queue is running
- **THEN** the system SHALL return a 409 error

### Requirement: Resume queue
The system SHALL expose `POST /api/panel-queue/resume` to resume a paused queue.

#### Scenario: Successful resume
- **WHEN** a resume request is made while a queue is paused
- **THEN** the current volume's processing SHALL resume and both the queue and current item status SHALL be updated to `running`

#### Scenario: Resume when not paused
- **WHEN** a resume request is made but no queue is paused
- **THEN** the system SHALL return a 409 error

### Requirement: Cancel queue
The system SHALL expose `POST /api/panel-queue/cancel` to cancel the active queue.

#### Scenario: Successful cancellation
- **WHEN** a cancel request is made while a queue is running or paused
- **THEN** the current volume's processing SHALL stop, the current item SHALL be marked `cancelled`, remaining pending items SHALL be marked `skipped`, and the queue status SHALL be set to `cancelled`. Already-completed items SHALL retain their `panel_data`.

#### Scenario: Cancel when idle
- **WHEN** a cancel request is made but no queue is active
- **THEN** the system SHALL return a 409 error
