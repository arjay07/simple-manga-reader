## Context

The manga reader currently requires manual filesystem placement of PDFs. A Python CLI script (`download_gdrive.py`) uses `gdown` to download from Google Drive folders, but has no web integration. Users want to add series directly from the library UI in Admin Mode by pasting a Google Drive folder link.

The app is a Next.js 16 App Router project with SQLite storage, Tailwind CSS v4, and a context-based Admin Mode. PDFs live at `MANGA_DIR/<Series>/<Volume>.pdf`. The existing scanner (`src/lib/scanner.ts`) syncs the filesystem into SQLite.

## Goals / Non-Goals

**Goals:**
- Download all PDF files from a public Google Drive folder into the manga directory
- Real-time progress feedback: per-file progress bars, overall progress, download speed
- Pause mid-file and resume using Range headers without re-downloading completed bytes
- Cancel downloads with cleanup of partial files
- Background downloads that persist when the modal is closed
- Auto-rescan library when download completes

**Non-Goals:**
- OAuth / private folder support (API key + public folders only)
- Multiple simultaneous download jobs (one at a time)
- Drag-and-drop file upload from local machine
- Download queue / scheduling system
- Mobile-specific UI optimizations

## Decisions

### 1. Pure Node.js with Google Drive REST API over Python subprocess

Download files using native `fetch()` against the Google Drive v3 REST API with an API key, rather than shelling out to the Python `gdown` script.

**Rationale:** Full programmatic control over per-file progress tracking, pause/resume via `AbortController`, and byte-level streaming. Subprocess approach would require parsing stdout for progress and has no clean pause/resume mechanism.

**Alternative considered:** Spawning `download_gdrive.py` as a child process and parsing its output. Rejected due to limited control over progress granularity and pause semantics.

### 2. SSE for real-time progress over polling

Use Server-Sent Events (SSE) via a `GET /api/gdrive/progress/[jobId]` endpoint that streams `DownloadEvent` objects.

**Rationale:** SSE provides push-based updates with no polling overhead. Native browser support via `EventSource`. Unidirectional (server→client) fits this use case perfectly since control commands (pause/resume/cancel) use separate POST endpoints.

**Alternative considered:** WebSocket (bidirectional, more complex setup, overkill), polling (adds latency and unnecessary requests).

### 3. In-memory singleton Download Manager

A `DownloadManager` class stored as a module-level singleton manages active jobs. Each job tracks file list, download state, progress, and connected SSE listeners.

**Rationale:** Simple, no additional infrastructure. Jobs only need to survive across HTTP requests within the same server process, not across server restarts. The manifest file on disk provides resume-across-restart capability.

**Trade-off:** Server restart loses in-progress job state. Mitigated by `.download_manifest.json` tracking completed files — user can re-initiate the same URL and it skips already-downloaded files.

### 4. Mid-file pause/resume with .part files and Range headers

During download, bytes stream to `<filename>.part`. On pause, the `AbortController` aborts the fetch, and the `.part` file remains on disk. On resume, a new fetch starts with `Range: bytes=<partFileSize>-` and appends to the `.part` file. On completion, `.part` is renamed to the final filename.

**Rationale:** Manga PDFs are 50-200MB. Re-downloading from scratch on resume wastes significant time and bandwidth. Google Drive supports Range headers for partial content requests.

### 5. Modal dialog over dedicated page or panel

The download UI lives in a modal overlay triggered by a FAB on the library page (admin-only). Closing the modal does not cancel the download; a small indicator on the library page shows active download status and can reopen the modal.

**Rationale:** Keeps users in the library context. No route changes needed. The FAB is unobtrusive when not in use. Background indicator ensures download visibility without the modal being open.

### 6. Google Drive folder listing via API key

Extract the folder ID from the pasted URL, then call `GET https://www.googleapis.com/drive/v3/files?q='<folderId>'+in+parents&key=<apiKey>&fields=files(id,name,size,mimeType)` to enumerate contents. Filter to PDF files only.

**Rationale:** Clean, documented API. API key auth is sufficient for public folders. Returns file metadata (name, size) needed for the itemized progress UI before any downloading begins.

### 7. Auto-rescan on completion

After the last file downloads successfully (or on cancel with some files completed), call `scanMangaDirectory()` to sync the new files into SQLite. The series then appears in the library grid immediately.

**Rationale:** Eliminates the extra manual step. The scanner is idempotent and fast (skips existing entries). No risk of duplicate data.

## Risks / Trade-offs

- **[Google Drive rate limiting]** → Downloading many large files quickly may trigger rate limits. Mitigation: sequential file downloads (not parallel), and retry with exponential backoff on 403/429 responses.
- **[API key exposure]** → The API key is server-side only (env var, used in API routes). Never sent to the client. Low risk.
- **[Large folder enumeration]** → Google Drive API paginates at 100 files per page. Mitigation: follow `nextPageToken` to get the complete file list before starting downloads.
- **[Disk space]** → No pre-check for available disk space. Mitigation: surface download errors clearly if writes fail. Could add a pre-check in a future iteration.
- **[Server restart during download]** → In-memory job state is lost. Mitigation: `.download_manifest.json` tracks completed files. User re-initiates with the same URL and completed files are skipped. `.part` files for interrupted downloads are cleaned up on the next attempt.
- **[Non-PDF files in Drive folder]** → Some folders may contain non-PDF files (images, text). Mitigation: filter file list to `.pdf` extension and `application/pdf` mimeType during folder listing.
