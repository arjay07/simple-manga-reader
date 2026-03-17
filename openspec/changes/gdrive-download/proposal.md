## Why

Users currently add manga series by manually downloading PDFs to the filesystem and triggering a library rescan. The `download_gdrive.py` CLI script automates Google Drive downloads but requires shell access. Integrating this into the web UI lets users add new series directly from the library page in Admin Mode — paste a Google Drive link, name the series, and watch it download with full progress visibility.

## What Changes

- New API routes under `/api/gdrive/` to start, monitor, pause, resume, and cancel Google Drive folder downloads
- Server-side download manager (in-memory singleton) that fetches files from Google Drive using the REST API with an API key
- Mid-file pause/resume support using `.part` files and HTTP Range headers
- SSE (Server-Sent Events) endpoint for real-time progress streaming to the client
- Modal dialog UI with per-file progress bars, download speed, and pause/cancel controls
- Floating action button (FAB) on the library page, visible only in Admin Mode, to trigger the download modal
- Background download indicator on the library page when the modal is closed
- Auto-rescan of the library (`scanMangaDirectory()`) when a download completes
- New `GOOGLE_API_KEY` environment variable for Google Drive API access

## Capabilities

### New Capabilities
- `gdrive-download-api`: Server-side download manager and API routes for starting, pausing, resuming, cancelling, and streaming progress of Google Drive folder downloads
- `gdrive-download-ui`: Modal dialog with download form, itemized file list, per-file and overall progress bars, speed indicator, pause/resume/cancel controls, FAB trigger, and background download indicator

### Modified Capabilities
<!-- No existing capability requirements are changing -->

## Impact

- **New dependency**: None (uses native `fetch` for Google Drive API calls)
- **New env var**: `GOOGLE_API_KEY` required for Google Drive folder listing and file downloads
- **API surface**: 5 new routes under `/api/gdrive/` (start, progress, pause, resume, cancel)
- **Filesystem**: Downloads write to `MANGA_DIR/<series>/` with `.part` files for incomplete downloads and `.download_manifest.json` for tracking
- **Existing code**: Calls `scanMangaDirectory()` from `src/lib/scanner.ts` on download completion — no changes to scanner itself
- **Admin UI**: New FAB component on library page, new modal component, new background indicator component
