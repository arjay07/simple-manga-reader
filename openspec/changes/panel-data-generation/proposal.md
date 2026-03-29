## Why

The panel detection system currently only supports one-off testing of individual pages via the admin panel-detect page. To actually use panel data in the reader (smart panel zooming), we need a way to batch-process all pages in a volume and persist the results. This change adds a job system to generate and store panel data for entire volumes, and a client-side toggle in the reader to consume that data for panel-by-panel navigation.

## What Changes

- **New admin page** (`/admin/panel-jobs`) for starting, monitoring, pausing/resuming, and cancelling panel data generation jobs
- **New `panel_data` SQLite table** to persist per-page panel detection results (panels, reading tree, page type)
- **Server-side job manager** (in-memory singleton) that processes all pages in a volume sequentially, with pause/resume/cancel support, one job at a time
- **New API endpoints** for job control (`/api/panel-jobs`) and panel data retrieval (`/api/panel-data`)
- **Progress UI** with progress bar, ETA, and a modal to preview already-processed pages with panel overlays
- **Smart panel zoom toggle** in the manga reader, saved in client localStorage, that uses stored panel data to zoom to individual panels in reading order

## Capabilities

### New Capabilities
- `panel-data-storage`: Persistence of panel detection results per page per volume in SQLite, with APIs to query and retrieve stored data
- `panel-generation-jobs`: Server-side job engine to batch-process all pages in a volume, with pause/resume/cancel, progress tracking, and an admin UI to control and monitor jobs
- `smart-panel-zoom`: Client-side reader feature that uses stored panel data to navigate panel-by-panel with animated zoom, toggled via a reader setting

### Modified Capabilities
- `panel-detection`: Adding a page image extraction API endpoint (GET) for on-demand page rendering without running detection, used by the preview modal

## Impact

- **Database**: New `panel_data` table added via migration in `src/lib/db.ts`
- **API surface**: New route groups `/api/panel-jobs/*` and `/api/panel-data/*`; new GET endpoint under `/api/panel-detect` for page image extraction
- **Admin UI**: New page at `/admin/panel-jobs` with job controls and preview modal
- **Reader**: Modified reader page to support panel zoom mode; new localStorage key for the toggle
- **Server memory**: Job manager holds in-memory state for the active job (does not survive server restart, but skips already-processed pages on re-run)
- **Dependencies**: No new dependencies — uses existing ONNX/sharp/pdfjs infrastructure
