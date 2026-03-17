## 1. Types and Configuration

- [x] 1.1 Create `src/lib/gdrive/types.ts` with types: `DownloadJob`, `FileInfo`, `FileStatus`, `DownloadEvent` (SSE event union), `JobStatus`
- [x] 1.2 Add `GOOGLE_API_KEY` to environment variable handling and document in `.env.example`

## 2. Google Drive API Client

- [x] 2.1 Create `src/lib/gdrive/google-api.ts` with `extractFolderId(url)` to parse Google Drive folder URLs into folder IDs
- [x] 2.2 Implement `listFolderFiles(folderId, apiKey)` that calls the Drive v3 API with pagination, filters to PDF files, and returns `FileInfo[]`
- [x] 2.3 Implement `downloadFile(fileId, destPath, apiKey, options?)` that streams a file to disk as `.part`, supports Range headers for resume, tracks bytes for progress callbacks, and renames to final name on completion

## 3. Download Manager

- [x] 3.1 Create `src/lib/gdrive/download-manager.ts` as a singleton class with a `Map<jobId, DownloadJob>` for job storage
- [x] 3.2 Implement `startJob(url, seriesName)` — creates output dir, loads manifest, lists folder files, skips already-downloaded files, begins sequential download loop
- [x] 3.3 Implement `pauseJob(jobId)` — aborts current fetch via AbortController, keeps `.part` file, sets status to `paused`
- [x] 3.4 Implement `resumeJob(jobId)` — checks `.part` file size, resumes download with Range header, continues through remaining files
- [x] 3.5 Implement `cancelJob(jobId)` — aborts fetch, deletes `.part` files, triggers rescan if any files completed, removes job
- [x] 3.6 Implement SSE listener management — `addListener(jobId, callback)`, `removeListener(jobId, callback)`, emit events to all listeners on progress/completion/error
- [x] 3.7 Implement manifest tracking — load/save `.download_manifest.json`, record completed files with MD5 hash, skip existing files on re-download
- [x] 3.8 Implement retry logic with exponential backoff for 429/403 responses (3s base, 5 max retries)
- [x] 3.9 Call `scanMangaDirectory()` on job completion or cancellation with completed files

## 4. API Routes

- [x] 4.1 Create `POST /api/gdrive/start/route.ts` — validate inputs, check no active job, call `startJob()`, return `{ jobId, files }`
- [x] 4.2 Create `GET /api/gdrive/progress/[jobId]/route.ts` — SSE endpoint that registers a listener, sends current state snapshot, then streams events until job completes or client disconnects
- [x] 4.3 Create `POST /api/gdrive/pause/[jobId]/route.ts` — validate job exists and is downloading, call `pauseJob()`
- [x] 4.4 Create `POST /api/gdrive/resume/[jobId]/route.ts` — validate job exists and is paused, call `resumeJob()`
- [x] 4.5 Create `POST /api/gdrive/cancel/[jobId]/route.ts` — validate job exists, call `cancelJob()`
- [x] 4.6 Create `GET /api/gdrive/status/route.ts` — returns current job status (if any) for the background indicator to check on page load

## 5. UI Components

- [x] 5.1 Create `src/components/GDrive/GDriveDownloadModal.tsx` — modal dialog with form view (URL + series name inputs, start button) and progress view (file list, overall progress, controls)
- [x] 5.2 Implement the form view with input validation (URL format, non-empty series name) and error display
- [x] 5.3 Implement the progress view with scrollable itemized file list showing per-file status (queued/downloading/complete/error/skipped), individual progress bars, and file sizes
- [x] 5.4 Implement the overall progress bar with percentage, file count, aggregate download speed, and elapsed time
- [x] 5.5 Implement pause/resume button that toggles based on job status and calls the respective API endpoints
- [x] 5.6 Implement cancel button with confirmation prompt
- [x] 5.7 Create `src/components/GDrive/GDriveDownloadFAB.tsx` — floating action button visible only in admin mode, changes appearance when a download is active
- [x] 5.8 Create `src/components/GDrive/GDriveDownloadIndicator.tsx` — small persistent bar on the library page showing series name, progress %, and speed; click reopens modal
- [x] 5.9 Implement SSE client hook `useGDriveProgress(jobId)` that connects to the progress endpoint, handles reconnection, and provides reactive state for the modal and indicator

## 6. Integration

- [x] 6.1 Add the FAB and indicator components to the library page layout, gated by `useAdmin()` context
- [x] 6.2 Wire modal open/close state — FAB opens modal, indicator reopens modal, closing modal shows indicator if download active
- [x] 6.3 Trigger library data refetch after download completion (auto-rescan happens server-side, client needs to re-query `/api/manga`)
- [x] 6.4 Handle edge case: check for active job on page load via `GET /api/gdrive/status` and show indicator if a background download is running

## 7. Verification

- [ ] 7.1 (Manual) Verify full flow: paste URL → list files → download with progress → pause → resume → complete → series appears in library
- [ ] 7.2 (Manual) Verify cancel flow: cancel mid-download → `.part` files cleaned up → completed files appear in library
- [ ] 7.3 (Manual) Verify re-download: start same URL again → already-downloaded files skipped
- [ ] 7.4 (Manual) Verify background persistence: close modal → indicator shows → reopen modal → progress reconnects
- [ ] 7.5 (Manual) Verify error handling: invalid URL, private folder, no API key, network failure
- [x] 7.6 Run `npm run build` to verify no compilation errors
