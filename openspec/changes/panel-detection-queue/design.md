## Context

Panel detection currently runs through a `JobManager` singleton (`src/lib/panel-detect/job-manager.ts`) that processes one volume at a time. All state is in-memory — a server restart loses progress tracking. The admin UI at `/admin/panel-jobs` uses dropdowns to select a single series and volume, then starts a job. To process a full series, users must manually queue each volume sequentially.

The existing `JobManager` already has solid per-volume capabilities: page-level processing with skip-if-exists, pause/resume via a promise-based gate, cancel, and error tolerance per page. The `panel_data` table stores results per page, which serves as ground truth for what's been processed.

## Goals / Non-Goals

**Goals:**
- Queue multiple volumes for sequential processing with a single action
- Persist queue state in SQLite so processing survives server restarts
- Auto-resume interrupted queues on server boot
- Unified flow: single-volume jobs go through the same queue path
- Checkbox-based volume selection in the admin UI

**Non-Goals:**
- Parallel volume processing (one volume at a time to avoid resource contention)
- Adding volumes to an already-running queue (cancel and re-queue instead)
- Drag-to-reorder queue items (always volume-number order)
- Queue history browsing UI (tables store history but no UI for it in v1)
- Replacing the internal `JobManager` (it continues to handle per-volume page loops)

## Decisions

### 1. QueueProcessor wraps JobManager (not replaces)

**Choice**: New `QueueProcessor` singleton orchestrates multi-volume queues, delegating per-volume work to the existing `JobManager`.

**Alternatives considered**:
- *Replace JobManager entirely*: Would unify code but requires rewriting the page-processing loop and all pause/resume logic. Higher risk for no functional gain.
- *Extend JobManager with queue support*: Would bloat a class that's already well-scoped. Violates single responsibility.

**Rationale**: The `JobManager`'s page loop, pause gate, and skip logic are battle-tested. The queue is a higher-level orchestration concern. Wrapping keeps changes minimal and risk low.

### 2. Two SQLite tables for queue state

**Choice**: `panel_queue` (one row per queue run) + `panel_queue_items` (one row per volume in the queue).

**Alternatives considered**:
- *Single table with volume_ids as JSON*: Simpler schema but makes per-item status updates awkward and loses the ability to query individual item status efficiently.
- *Reuse existing panel_data as the only state*: Not enough — we need to know which volumes are pending, not just which pages are done.

**Rationale**: Two tables cleanly separate the queue-level state (paused, confidence threshold) from per-item state (which volume is running, how far along). SQL queries are straightforward.

### 3. Auto-resume on server boot

**Choice**: `instrumentation.ts` checks for a queue with status `running` and automatically resumes it.

**Alternatives considered**:
- *Resume as paused*: Safer (no surprise CPU load) but defeats the "walk away" use case. If the server restarts from a Docker restart policy or system reboot, the user expects it to keep going.
- *Configurable via settings*: Over-engineering for this use case.

**Rationale**: The primary use case is "start a series and walk away." Auto-resume supports this, and a queue that was explicitly paused before the crash stays paused.

### 4. Page-level resume is free via existing skip logic

**Choice**: When resuming a volume that was interrupted mid-processing, simply re-start it via `JobManager.start()`. The existing `getPanelDataForPage()` check skips pages that already have `panel_data` rows.

**Rationale**: No new page-level resume mechanism needed. The worst case is one page gets reprocessed (if the crash happened after detection but before the DB insert for that page). This is acceptable.

### 5. Existing /api/panel-jobs routes removed

**Choice**: Replace old routes with new `/api/panel-queue/` routes. The old routes were internal-only (used by the admin page, not external consumers).

**Alternatives considered**:
- *Keep both*: Two ways to start jobs would be confusing and could conflict (starting a direct job while a queue is running).

**Rationale**: Clean break. The admin UI is the only consumer.

### 6. Cancel preserves completed work

**Choice**: Cancelling a queue stops the current volume and marks remaining items as skipped. Already-completed volumes retain their `panel_data`.

**Rationale**: Panel detection is expensive. Throwing away completed work on cancel would be frustrating. Users can use `force: true` on a new queue if they want to redo specific volumes.

## Risks / Trade-offs

- **[Risk] JobManager pause/resume relies on in-memory promise gate** → On restart, we can't "resume" the JobManager mid-volume. Instead we re-start the volume and rely on page-skip. This means the volume appears to start over (progress resets to 0 before quickly skipping to the right page). Mitigation: UI can show "resuming..." state during the skip phase.

- **[Risk] Only one queue at a time** → If a user wants to process two series concurrently, they can't. Mitigation: Acceptable for v1 given panel detection is CPU-intensive. Could add parallel queue support later.

- **[Risk] instrumentation.ts runs on every server boot** → Auto-resume query runs even when there's nothing to resume. Mitigation: Single lightweight SQLite query, negligible cost.

- **[Trade-off] Queue items are ordered by volume number, not customizable** → Users with specific ordering needs must cancel and re-queue. Acceptable for simplicity.
