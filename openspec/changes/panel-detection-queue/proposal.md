## Why

Panel detection currently processes one volume at a time with all state held in memory. To process an entire series, users must manually start each volume after the previous one finishes. If the server restarts, all progress tracking is lost and the user must figure out which volumes still need processing. A persistent, multi-volume queue makes it practical to kick off detection for an entire series and walk away.

## What Changes

- New SQLite tables (`panel_queue`, `panel_queue_items`) persist queue state across server restarts
- New `QueueProcessor` singleton wraps the existing `JobManager` to orchestrate multi-volume processing in volume-number order
- New API routes under `/api/panel-queue/` for creating, polling, pausing, resuming, and cancelling queues
- Admin UI at `/admin/panel-jobs` replaced with a checkbox-based volume selector — users check the volumes they want, click Generate, and the queue processes them sequentially
- Single-volume jobs go through the same queue path (queue with 1 item)
- `instrumentation.ts` auto-resumes any interrupted queue on server boot
- Cancel keeps completed work; only skips remaining items

## Capabilities

### New Capabilities
- `panel-queue-persistence`: SQLite-backed queue with item-level status tracking, surviving server restarts with auto-resume on boot
- `panel-queue-api`: API routes for creating multi-volume queues and controlling execution (pause/resume/cancel) at the queue level

### Modified Capabilities
- `panel-generation-jobs`: The single-volume job model is replaced by a queue-based model. All jobs now go through the queue (single volume = queue with 1 item). The existing `JobManager` continues to handle per-volume page processing internally, but is no longer directly exposed via API. Admin UI changes from series+volume dropdowns to a checkbox multi-select of volumes within a series.

## Impact

- **Database**: Two new tables (`panel_queue`, `panel_queue_items`). No changes to existing `panel_data` table.
- **Code**: New `src/lib/panel-detect/queue-processor.ts`. Modified `src/instrumentation.ts` (auto-resume). New API routes under `src/app/api/panel-queue/`. Major rewrite of `src/app/admin/panel-jobs/page.tsx` (checkbox UI, queue progress).
- **APIs**: New routes: `POST /api/panel-queue`, `GET /api/panel-queue/current`, `POST /api/panel-queue/pause`, `POST /api/panel-queue/resume`, `POST /api/panel-queue/cancel`. Existing `/api/panel-jobs/*` routes kept for backward compat or removed (they were internal-only).
- **Dependencies**: None new.
- **Existing behavior**: `JobManager` preserved internally but no longer the public interface. Page-level skip logic (existing `panel_data` rows) provides free page-level resume on restart.
