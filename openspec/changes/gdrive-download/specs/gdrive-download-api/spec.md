## ADDED Requirements

### Requirement: Start a download job from a Google Drive folder URL
The system SHALL accept a Google Drive folder URL and series name, extract the folder ID, list all PDF files in the folder via the Google Drive API, and begin downloading them sequentially to `MANGA_DIR/<seriesName>/`. The system SHALL return a job ID and the file list to the client.

#### Scenario: Valid public folder URL with PDF files
- **WHEN** a POST request is made to `/api/gdrive/start` with a valid Google Drive folder URL and series name
- **THEN** the system extracts the folder ID, lists folder contents filtered to PDF files, creates a download job, returns `{ jobId, files: [{ name, size }] }`, and begins downloading the first file

#### Scenario: Invalid or inaccessible URL
- **WHEN** a POST request is made with a URL that is not a valid Google Drive folder or the folder is private
- **THEN** the system returns a 400 error with a descriptive message

#### Scenario: Folder contains no PDF files
- **WHEN** the Google Drive folder contains no PDF files
- **THEN** the system returns a 400 error indicating no downloadable PDF files were found

#### Scenario: Download already in progress
- **WHEN** a POST request is made while another download job is active
- **THEN** the system returns a 409 error indicating a download is already in progress

### Requirement: Stream real-time download progress via SSE
The system SHALL provide a Server-Sent Events endpoint that streams progress events for an active download job.

#### Scenario: Client connects to progress stream
- **WHEN** a GET request is made to `/api/gdrive/progress/[jobId]`
- **THEN** the system opens an SSE connection and streams events including `file-list`, `file-progress`, `file-complete`, `file-error`, and `done`

#### Scenario: File progress events
- **WHEN** a file is being downloaded
- **THEN** the system emits `file-progress` events containing the filename, bytes downloaded, total bytes, and current download speed (bytes/sec)

#### Scenario: File completion events
- **WHEN** a file finishes downloading
- **THEN** the system emits a `file-complete` event with the filename and final file size

#### Scenario: Client reconnects mid-download
- **WHEN** a client disconnects and reconnects to the SSE endpoint for an active job
- **THEN** the system sends the current state (file list with statuses) followed by ongoing progress events

### Requirement: Pause an active download
The system SHALL allow pausing an active download job, aborting the current file transfer while preserving the `.part` file on disk.

#### Scenario: Pause during file download
- **WHEN** a POST request is made to `/api/gdrive/pause/[jobId]` while a file is downloading
- **THEN** the system aborts the current fetch via AbortController, keeps the `.part` file on disk, sets the job status to `paused`, and emits a `paused` SSE event

#### Scenario: Pause when no download is active
- **WHEN** a POST request is made to pause a job that is not in `downloading` status
- **THEN** the system returns a 400 error

### Requirement: Resume a paused download
The system SHALL allow resuming a paused download, continuing from where the current file left off using HTTP Range headers.

#### Scenario: Resume with partial file on disk
- **WHEN** a POST request is made to `/api/gdrive/resume/[jobId]` and a `.part` file exists for the current file
- **THEN** the system resumes downloading with a `Range: bytes=<partSize>-` header, appending to the `.part` file, sets status to `downloading`, and resumes SSE progress events

#### Scenario: Resume with no partial file
- **WHEN** a POST request is made to resume and no `.part` file exists for the current file
- **THEN** the system starts downloading the current file from the beginning

### Requirement: Cancel a download job
The system SHALL allow cancelling an active or paused download job, cleaning up partial files.

#### Scenario: Cancel an active download
- **WHEN** a POST request is made to `/api/gdrive/cancel/[jobId]`
- **THEN** the system aborts any active fetch, deletes all `.part` files, emits a `cancelled` SSE event, removes the job from the download manager, and triggers a library rescan if any files were fully downloaded

#### Scenario: Cancel a non-existent job
- **WHEN** a POST request is made to cancel a job ID that does not exist
- **THEN** the system returns a 404 error

### Requirement: Track completed files with a manifest
The system SHALL maintain a `.download_manifest.json` file in the series output directory that records each completed file's name, size, and MD5 hash.

#### Scenario: File completes successfully
- **WHEN** a file download completes and the `.part` file is renamed to its final name
- **THEN** the system computes the file's MD5 hash and writes an entry to `.download_manifest.json`

#### Scenario: Re-download same folder URL
- **WHEN** a download is started for a folder URL where some files already exist in the output directory and are tracked in the manifest
- **THEN** the system skips files that already exist with matching sizes and marks them as `complete` in the file list

### Requirement: Auto-rescan library on download completion
The system SHALL trigger `scanMangaDirectory()` when a download job completes (all files downloaded) or is cancelled with at least one completed file.

#### Scenario: All files downloaded successfully
- **WHEN** the last file in the job completes downloading
- **THEN** the system calls `scanMangaDirectory()` and emits a `done` SSE event with download summary

#### Scenario: Cancelled with partial downloads
- **WHEN** a job is cancelled after some files have fully downloaded
- **THEN** the system calls `scanMangaDirectory()` so the completed files appear in the library

### Requirement: Handle Google Drive API errors gracefully
The system SHALL retry failed file downloads with exponential backoff and surface errors to the client.

#### Scenario: Rate limit (429) response from Google
- **WHEN** Google Drive returns a 429 or 403 rate-limit response during file download
- **THEN** the system retries after exponential backoff (starting at 3 seconds, up to 5 retries) and emits a `file-error` SSE event with retry information

#### Scenario: Permanent file download failure
- **WHEN** a file fails to download after all retry attempts
- **THEN** the system emits a `file-error` event with the error details, skips the file, and continues to the next file in the queue
