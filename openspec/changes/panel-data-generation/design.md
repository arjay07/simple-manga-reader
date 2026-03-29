## Context

The panel detection system currently supports single-page analysis via `POST /api/panel-detect`, using a YOLO ONNX model for ML-based detection. Results are returned to the client but not persisted. The admin page at `/admin/panel-detect` is a test/debug tool for one-off detection.

To enable smart panel zooming in the reader, we need pre-computed panel data for all pages in a volume. This requires a batch processing system with progress tracking, persistence, and a way for the reader to consume the stored data.

Existing infrastructure: better-sqlite3 (sync), ONNX Runtime for inference, sharp for image processing, pdfjs for page extraction. All server-side.

## Goals / Non-Goals

**Goals:**
- Batch-process all pages in a volume to generate and persist panel data
- Provide admin UI with real-time progress, pause/resume, and cancel
- Allow previewing processed pages with panel overlays in a modal
- Store panel data efficiently for fast retrieval by the reader
- Add a client-side smart panel zoom toggle in the reader

**Non-Goals:**
- Multi-job concurrency (one job at a time is sufficient)
- Job persistence across server restarts (in-memory is fine; re-run skips done pages)
- Panel data editing or manual correction
- Zoom animation implementation details in this phase (toggle + data loading only for reader)

## Decisions

### Decision 1: In-memory job manager singleton

**Choice**: A `JobManager` class held as a module-level singleton, managing one active job as an async loop.

**Alternatives considered**:
- *Database-backed job queue*: Survives restarts, but adds complexity for a single-user admin tool. Over-engineered.
- *Worker threads*: Would allow true background processing, but ONNX session sharing across threads is complex. The async loop is sufficient since inference is the bottleneck and already async.

**Rationale**: The job manager is just flow control — a `for` loop with pause/cancel checks. Since already-processed pages are skipped on re-run, losing in-memory state on restart is a non-issue.

### Decision 2: SQLite `panel_data` table with JSON columns

**Choice**: Store panels as a JSON text column (`panels_json`) and reading tree as another (`reading_tree_json`), keyed by `(volume_id, page_number)`.

**Alternatives considered**:
- *Normalized panel rows*: One row per panel with FK to a page row. More relational, but panels are always loaded together as a set per page, and the client already works with the JSON shape. Normalization adds joins for no benefit.
- *JSON files on disk*: Easier to inspect, but splits storage across two systems. SQLite is already the single source of truth for everything else.

**Rationale**: JSON columns match the existing `Panel[]` type shape exactly. SQLite's JSON functions are available if we ever need to query into panel data. The `UNIQUE(volume_id, page_number)` constraint ensures idempotent inserts.

### Decision 3: Client-driven polling for progress

**Choice**: Client polls `GET /api/panel-jobs/current` every ~2 seconds to get job status and progress.

**Alternatives considered**:
- *Server-Sent Events (SSE)*: Real-time push, but adds connection management complexity. With ~2s page processing time, polling at 2s intervals is nearly real-time anyway.
- *WebSocket*: Even more complex. Overkill for unidirectional progress updates.

**Rationale**: Polling is simple, stateless, and sufficient given the processing rate. The job status endpoint returns enough data (processed count, total, current page, per-page summaries) that the client can render rich progress UI.

### Decision 4: On-demand page image extraction for preview

**Choice**: The preview modal fetches page images on demand via a new `GET /api/panel-data/:volumeId/:page/image` endpoint, rather than storing images during job processing.

**Rationale**: Storing base64 images per page would add ~100-500KB per page to the database. A 200-page volume would add 20-100MB. On-demand extraction reuses the existing `extractPageAsImage` function and keeps storage lean.

### Decision 5: Pause via async signal

**Choice**: The job loop checks a `paused` boolean before each page. When paused, it awaits a `Promise` that gets resolved when resume is called. This is zero-overhead when not paused.

```
// Pseudocode
for (page of pages) {
  while (this.paused) await this.resumePromise;
  if (this.cancelled) break;
  // process page...
}
```

### Decision 6: Smart panel zoom as localStorage toggle

**Choice**: The reader stores a `smartPanelZoom` boolean in localStorage. When enabled and panel data exists for the current volume, tapping navigates between panels instead of pages.

**Rationale**: No server-side user preference needed — this is a viewing preference that can vary by device. localStorage is already used for reading progress caching.

## Risks / Trade-offs

- **[Job lost on restart]** → Mitigated by skip-already-processed logic. Re-running a job for a partially-processed volume only processes remaining pages.
- **[ONNX model memory during long jobs]** → The model session is already cached as a singleton. No additional memory growth per page. Sharp buffers are GC'd after each page.
- **[Large volumes slow to process]** → A 300-page volume at ~2s/page = ~10 minutes. Progress bar + pause/resume makes this manageable. ETA display helps set expectations.
- **[No queue for multiple volumes]** → If a job is running, starting another is rejected. User must wait or cancel. Acceptable for a single-admin tool.
- **[Panel data staleness]** → If the PDF changes, panel data becomes stale. The "re-generate" option (delete + re-run) handles this. No automatic invalidation.
