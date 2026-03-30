## ADDED Requirements

### Requirement: Queue table schema
The system SHALL create a `panel_queue` table with columns: `id` (INTEGER PRIMARY KEY), `series_id` (INTEGER REFERENCES series), `status` (TEXT: pending, running, paused, completed, cancelled, error), `confidence_threshold` (REAL, default 0.25), `force` (INTEGER, default 0), `created_at` (DATETIME), `started_at` (DATETIME), `completed_at` (DATETIME).

#### Scenario: Table creation on DB init
- **WHEN** the database is initialized
- **THEN** the `panel_queue` table SHALL be created if it does not exist

### Requirement: Queue items table schema
The system SHALL create a `panel_queue_items` table with columns: `id` (INTEGER PRIMARY KEY), `queue_id` (INTEGER REFERENCES panel_queue ON DELETE CASCADE), `volume_id` (INTEGER REFERENCES volumes), `sort_order` (INTEGER), `status` (TEXT: pending, running, completed, skipped, error), `total_pages` (INTEGER, default 0), `processed_pages` (INTEGER, default 0), `current_page` (INTEGER, default 0), `started_at` (DATETIME), `completed_at` (DATETIME), `error` (TEXT).

#### Scenario: Table creation on DB init
- **WHEN** the database is initialized
- **THEN** the `panel_queue_items` table SHALL be created if it does not exist

### Requirement: Queue state persistence
The `QueueProcessor` SHALL update SQLite rows as queue state changes. Queue-level status transitions and per-item status transitions SHALL be written to the database immediately, not batched.

#### Scenario: Queue created
- **WHEN** a new queue is created with selected volumes
- **THEN** a `panel_queue` row SHALL be inserted with status `pending`, and one `panel_queue_items` row SHALL be inserted per volume with status `pending` and `sort_order` set to the volume's `volume_number`

#### Scenario: Volume starts processing
- **WHEN** the queue processor begins a volume
- **THEN** the corresponding `panel_queue_items` row SHALL be updated to status `running` with `started_at` set to the current time, and the `panel_queue` row SHALL be updated to status `running` if not already

#### Scenario: Volume completes
- **WHEN** a volume finishes processing
- **THEN** the corresponding `panel_queue_items` row SHALL be updated to status `completed` with `completed_at`, `total_pages`, and `processed_pages` reflecting final values

#### Scenario: Queue paused
- **WHEN** the user pauses the queue
- **THEN** the `panel_queue` row SHALL be updated to status `paused`, and the currently-running item SHALL be updated to status `paused`

#### Scenario: Queue cancelled
- **WHEN** the user cancels the queue
- **THEN** the `panel_queue` row SHALL be updated to status `cancelled`, the currently-running item SHALL be updated to status `cancelled`, and all remaining `pending` items SHALL be updated to status `skipped`

### Requirement: Auto-resume on server boot
The system SHALL check for an interrupted queue on startup via `instrumentation.ts`. If a queue exists with status `running`, processing SHALL resume automatically. If a queue exists with status `paused`, it SHALL remain paused (user must manually resume).

#### Scenario: Server restarts during a running queue
- **WHEN** the server boots and a `panel_queue` row has status `running`
- **THEN** the system SHALL identify the item that was `running`, re-start it via `JobManager` (which skips already-processed pages via existing `panel_data` rows), and continue with remaining pending items

#### Scenario: Server restarts during a paused queue
- **WHEN** the server boots and a `panel_queue` row has status `paused`
- **THEN** the system SHALL load the queue state but NOT start processing until the user resumes via the API

#### Scenario: Server restarts with no active queue
- **WHEN** the server boots and no `panel_queue` row has status `running` or `paused`
- **THEN** no queue processing SHALL be started

### Requirement: Page-level resume via existing panel_data
When resuming a volume after an interruption, the system SHALL rely on the existing `JobManager` skip logic — pages with existing `panel_data` rows are skipped automatically.

#### Scenario: Volume interrupted at page 47 of 200
- **WHEN** a volume was interrupted after processing 47 pages and is restarted
- **THEN** the `JobManager` SHALL skip pages 1-47 (which have `panel_data` rows) and resume processing from page 48
