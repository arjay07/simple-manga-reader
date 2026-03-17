## ADDED Requirements

### Requirement: Floating action button to trigger download modal
The system SHALL display a floating action button (FAB) on the library page that is only visible when Admin Mode is enabled.

#### Scenario: Admin mode enabled
- **WHEN** the user is on the library page and Admin Mode is on
- **THEN** a FAB with a "+" or download icon is visible in the bottom-right area of the screen

#### Scenario: Admin mode disabled
- **WHEN** Admin Mode is off
- **THEN** the FAB is not rendered

#### Scenario: Download in progress
- **WHEN** a download job is active and the modal is closed
- **THEN** the FAB changes appearance to indicate an active download (e.g., animated icon or progress ring) and clicking it reopens the modal

### Requirement: Download modal with URL input form
The system SHALL display a modal dialog with a form to input a Google Drive folder URL and series name.

#### Scenario: Opening the modal
- **WHEN** the user clicks the FAB
- **THEN** a modal overlay appears with inputs for "Google Drive URL" and "Series Name" and a "Start Download" button

#### Scenario: Starting a download
- **WHEN** the user fills in both fields and clicks "Start Download"
- **THEN** the system calls `POST /api/gdrive/start`, the form transitions to the progress view, and the file list appears

#### Scenario: Validation
- **WHEN** the user submits with an empty URL or series name
- **THEN** the form shows inline validation errors and does not submit

### Requirement: Itemized file list with per-file progress
The system SHALL display all files in the download job as a scrollable list, each showing its status and progress.

#### Scenario: File queued
- **WHEN** a file has not started downloading
- **THEN** it shows the filename, a "queued" status label, and a dash for size

#### Scenario: File downloading
- **WHEN** a file is actively downloading
- **THEN** it shows the filename, a progress bar with percentage, bytes downloaded / total bytes, and current download speed

#### Scenario: File completed
- **WHEN** a file has finished downloading
- **THEN** it shows the filename, the final file size, and a checkmark icon

#### Scenario: File errored
- **WHEN** a file failed to download
- **THEN** it shows the filename, an error icon, and a brief error message

#### Scenario: File skipped (already exists)
- **WHEN** a file was skipped because it already exists on disk
- **THEN** it shows the filename, the file size, and a "skipped" label

### Requirement: Overall download progress bar
The system SHALL display an overall progress bar showing aggregate download progress across all files.

#### Scenario: Downloads in progress
- **WHEN** files are being downloaded
- **THEN** the overall progress bar shows percentage based on total bytes downloaded / total bytes across all files, the current file count (e.g., "3 of 12 files"), and aggregate download speed

#### Scenario: All downloads complete
- **WHEN** all files have been downloaded or skipped
- **THEN** the overall progress bar shows 100%, a completion message, and the total time elapsed

### Requirement: Pause and resume controls
The system SHALL provide pause and resume buttons that control the active download job.

#### Scenario: Pause active download
- **WHEN** the user clicks the "Pause" button during an active download
- **THEN** the system calls `POST /api/gdrive/pause/[jobId]`, the button changes to "Resume", the current file progress bar freezes, and a "Paused" status label appears

#### Scenario: Resume paused download
- **WHEN** the user clicks the "Resume" button while paused
- **THEN** the system calls `POST /api/gdrive/resume/[jobId]`, the button changes to "Pause", and downloading resumes from where it left off

### Requirement: Cancel download control
The system SHALL provide a cancel button that stops the download and cleans up.

#### Scenario: Cancel download
- **WHEN** the user clicks the "Cancel" button
- **THEN** a confirmation prompt appears; on confirm, the system calls `POST /api/gdrive/cancel/[jobId]`, the modal shows a cancelled state, and partial files are cleaned up

### Requirement: Background download indicator
The system SHALL show a persistent indicator on the library page when a download is active and the modal is closed.

#### Scenario: Modal closed during active download
- **WHEN** the user closes the modal while a download is in progress
- **THEN** a small indicator appears on the library page showing the series name, current progress percentage, and download speed

#### Scenario: Clicking the indicator
- **WHEN** the user clicks the background download indicator
- **THEN** the download modal reopens and reconnects to the SSE progress stream showing current state

#### Scenario: Download completes in background
- **WHEN** a download completes while the modal is closed
- **THEN** the indicator shows a completion message briefly, the library grid refreshes to show the new series, and the indicator fades away

### Requirement: Error handling in the modal
The system SHALL display errors clearly within the modal UI.

#### Scenario: API key not configured
- **WHEN** the server has no `GOOGLE_API_KEY` configured and the user tries to start a download
- **THEN** the modal displays an error message indicating the API key needs to be configured

#### Scenario: Network error during download
- **WHEN** a network error occurs during download
- **THEN** the modal shows the error on the affected file and continues with remaining files

#### Scenario: Server error on start
- **WHEN** the `/api/gdrive/start` endpoint returns an error (e.g., invalid URL, folder not accessible)
- **THEN** the modal displays the error message and keeps the form visible for the user to correct and retry
