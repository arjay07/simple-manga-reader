## 1. Database Schema

- [x] 1.1 Add `panel_queue` and `panel_queue_items` CREATE TABLE statements to `src/lib/db.ts`

## 2. Queue Processor

- [x] 2.1 Create `src/lib/panel-detect/queue-processor.ts` with `QueueProcessor` singleton class that wraps `JobManager`
- [x] 2.2 Implement `create(seriesId, volumeIds, confidenceThreshold, force)` — inserts queue + items into SQLite, starts processing loop
- [x] 2.3 Implement `processLoop()` — iterates pending items by sort_order, delegates each to `JobManager.start()`, updates item/queue status in SQLite on completion
- [x] 2.4 Implement `pause()` — calls `jobManager.pause()`, updates queue and current item status to paused in SQLite
- [x] 2.5 Implement `resume()` — calls `jobManager.resume()`, updates queue and current item status to running in SQLite
- [x] 2.6 Implement `cancel()` — calls `jobManager.cancel()`, marks current item cancelled, remaining items skipped, queue cancelled in SQLite
- [x] 2.7 Implement `getState()` — returns queue-level status merged with current volume's page-level progress from `jobManager.getState()`
- [x] 2.8 Implement `restoreFromDb()` — loads an interrupted queue from SQLite and resumes or stays paused depending on stored status

## 3. API Routes

- [x] 3.1 Create `POST /api/panel-queue/route.ts` — validates input, calls `queueProcessor.create()`, returns 202
- [x] 3.2 Create `GET /api/panel-queue/current/route.ts` — returns `queueProcessor.getState()`
- [x] 3.3 Create `POST /api/panel-queue/pause/route.ts` — calls `queueProcessor.pause()`
- [x] 3.4 Create `POST /api/panel-queue/resume/route.ts` — calls `queueProcessor.resume()`
- [x] 3.5 Create `POST /api/panel-queue/cancel/route.ts` — calls `queueProcessor.cancel()`

## 4. Auto-Resume on Boot

- [x] 4.1 Add `resumePanelQueue()` call in `src/instrumentation.ts` that queries for a queue with status `running` or `paused`, and calls `queueProcessor.restoreFromDb()` (which auto-resumes running queues, leaves paused queues paused)

## 5. Admin UI Rewrite

- [x] 5.1 Replace series/volume dropdowns with series dropdown + volume checkbox list in `/admin/panel-jobs/page.tsx`
- [x] 5.2 Add "Select All" / "Select None" toggle for the volume checkboxes
- [x] 5.3 Show existing panel data status per volume (indicator for volumes that already have panel data)
- [x] 5.4 Wire "Generate Selected" button to `POST /api/panel-queue` with checked volume IDs
- [x] 5.5 Implement queue progress display: overall progress bar, per-item status list with page-level progress for the active volume, speed, ETA
- [x] 5.6 Wire Pause/Resume/Cancel buttons to new `/api/panel-queue/` endpoints
- [x] 5.7 Disable controls (series dropdown, checkboxes, generate button) while a queue is active
- [x] 5.8 Show completion summary when queue finishes
- [x] 5.9 Preserve the existing processed-pages preview modal (repoint it at the active/completed queue's volumes)

## 6. Cleanup

- [x] 6.1 Remove old `/api/panel-jobs/` route files (route.ts, current/route.ts, current/pause/route.ts, current/resume/route.ts, current/cancel/route.ts)
