import { getDb } from '../db';
import { jobManager } from './job-manager';
import type { JobState } from './job-manager';

export type QueueStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
export type QueueItemStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error' | 'paused' | 'cancelled';

export interface QueueItemState {
  id: number;
  volumeId: number;
  volumeTitle: string;
  sortOrder: number;
  status: QueueItemStatus;
  totalPages: number;
  processedPages: number;
  currentPage: number;
  error?: string;
}

export interface QueueState {
  status: QueueStatus;
  queueId?: number;
  seriesId?: number;
  seriesTitle?: string;
  confidenceThreshold: number;
  force: boolean;
  items: QueueItemState[];
  totalVolumes: number;
  completedVolumes: number;
  currentVolume?: QueueItemState;
  currentJobState?: JobState;
  startedAt?: number;
  createdAt?: string;
}

class QueueProcessor {
  private activeQueueId: number | null = null;
  private processing = false;
  private loopPromise: Promise<void> | null = null;

  isActive(): boolean {
    return this.activeQueueId !== null && this.processing;
  }

  async create(
    seriesId: number,
    volumeIds: number[],
    confidenceThreshold: number,
    force: boolean
  ): Promise<QueueState> {
    if (this.isActive()) {
      throw new Error('A queue is already active');
    }

    const db = getDb();

    // Validate series exists
    const series = db.prepare('SELECT id, title FROM series WHERE id = ?').get(seriesId) as
      | { id: number; title: string }
      | undefined;
    if (!series) {
      throw new Error('Series not found');
    }

    // Validate volumes exist and belong to the series, get their volume_number for ordering
    const volumes = volumeIds.map((vid) => {
      const vol = db
        .prepare(
          'SELECT id, title, volume_number, page_count FROM volumes WHERE id = ? AND series_id = ?'
        )
        .get(vid, seriesId) as
        | { id: number; title: string; volume_number: number | null; page_count: number | null }
        | undefined;
      if (!vol) {
        throw new Error(`Volume ${vid} not found in series ${seriesId}`);
      }
      return vol;
    });

    // Sort by volume_number (nulls last)
    volumes.sort((a, b) => {
      if (a.volume_number === null && b.volume_number === null) return 0;
      if (a.volume_number === null) return 1;
      if (b.volume_number === null) return -1;
      return a.volume_number - b.volume_number;
    });

    // Insert queue
    const queueResult = db
      .prepare(
        `INSERT INTO panel_queue (series_id, status, confidence_threshold, force, created_at)
         VALUES (?, 'pending', ?, ?, datetime('now'))`
      )
      .run(seriesId, confidenceThreshold, force ? 1 : 0);

    const queueId = queueResult.lastInsertRowid as number;

    // Insert items
    const insertItem = db.prepare(
      `INSERT INTO panel_queue_items (queue_id, volume_id, sort_order, status)
       VALUES (?, ?, ?, 'pending')`
    );

    for (let i = 0; i < volumes.length; i++) {
      insertItem.run(queueId, volumes[i].id, i);
    }

    this.activeQueueId = queueId;

    // Start processing loop (fire and forget)
    this.loopPromise = this.processLoop(queueId, confidenceThreshold, force).catch((err) => {
      console.error('Queue processor fatal error:', err);
      const errDb = getDb();
      errDb
        .prepare("UPDATE panel_queue SET status = 'error', completed_at = datetime('now') WHERE id = ?")
        .run(queueId);
      this.activeQueueId = null;
      this.processing = false;
    });

    return this.getState();
  }

  getState(): QueueState {
    const db = getDb();

    // If no active queue, check for the most recent one for display
    const queueId = this.activeQueueId;

    if (!queueId) {
      // Check for most recent queue
      const recent = db
        .prepare('SELECT id FROM panel_queue ORDER BY created_at DESC LIMIT 1')
        .get() as { id: number } | undefined;

      if (!recent) {
        return {
          status: 'pending',
          confidenceThreshold: 0.25,
          force: false,
          items: [],
          totalVolumes: 0,
          completedVolumes: 0,
        };
      }

      return this.buildState(recent.id);
    }

    return this.buildState(queueId);
  }

  private buildState(queueId: number): QueueState {
    const db = getDb();

    const queue = db.prepare(
      `SELECT pq.*, s.title as series_title
       FROM panel_queue pq
       LEFT JOIN series s ON pq.series_id = s.id
       WHERE pq.id = ?`
    ).get(queueId) as {
      id: number;
      series_id: number;
      status: QueueStatus;
      confidence_threshold: number;
      force: number;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
      series_title: string;
    } | undefined;

    if (!queue) {
      return {
        status: 'pending',
        confidenceThreshold: 0.25,
        force: false,
        items: [],
        totalVolumes: 0,
        completedVolumes: 0,
      };
    }

    const items = db.prepare(
      `SELECT pqi.*, v.title as volume_title
       FROM panel_queue_items pqi
       LEFT JOIN volumes v ON pqi.volume_id = v.id
       WHERE pqi.queue_id = ?
       ORDER BY pqi.sort_order`
    ).all(queueId) as Array<{
      id: number;
      volume_id: number;
      volume_title: string;
      sort_order: number;
      status: QueueItemStatus;
      total_pages: number;
      processed_pages: number;
      current_page: number;
      error: string | null;
    }>;

    const mappedItems: QueueItemState[] = items.map((item) => ({
      id: item.id,
      volumeId: item.volume_id,
      volumeTitle: item.volume_title,
      sortOrder: item.sort_order,
      status: item.status,
      totalPages: item.total_pages,
      processedPages: item.processed_pages,
      currentPage: item.current_page,
      error: item.error ?? undefined,
    }));

    const runningItem = mappedItems.find((i) => i.status === 'running');
    let currentJobState: JobState | undefined;

    // If there's a running item, get live progress from JobManager
    if (runningItem && jobManager.isActive()) {
      currentJobState = jobManager.getState();
      // Overlay live data onto the item
      runningItem.totalPages = currentJobState.totalPages;
      runningItem.processedPages = currentJobState.processedPages;
      runningItem.currentPage = currentJobState.currentPage;
    }

    const completedVolumes = mappedItems.filter(
      (i) => i.status === 'completed'
    ).length;

    return {
      status: queue.status,
      queueId: queue.id,
      seriesId: queue.series_id,
      seriesTitle: queue.series_title,
      confidenceThreshold: queue.confidence_threshold,
      force: queue.force === 1,
      items: mappedItems,
      totalVolumes: mappedItems.length,
      completedVolumes,
      currentVolume: runningItem,
      currentJobState,
      startedAt: queue.started_at ? new Date(queue.started_at).getTime() : undefined,
      createdAt: queue.created_at,
    };
  }

  pause(): QueueState {
    const db = getDb();

    if (!this.activeQueueId) {
      const running = db
        .prepare("SELECT id FROM panel_queue WHERE status = 'running' ORDER BY created_at DESC LIMIT 1")
        .get() as { id: number } | undefined;
      if (running) {
        this.activeQueueId = running.id;
      }
    }

    if (!this.activeQueueId) {
      throw new Error('No running queue to pause');
    }

    const queue = db
      .prepare('SELECT status FROM panel_queue WHERE id = ?')
      .get(this.activeQueueId) as { status: string } | undefined;

    if (queue?.status !== 'running') {
      throw new Error('Queue is not running');
    }

    // Pause the current volume in JobManager
    if (jobManager.isActive()) {
      try {
        jobManager.pause();
      } catch {
        // JobManager might not be in a pausable state
      }
    }

    // Update DB
    db.prepare("UPDATE panel_queue SET status = 'paused' WHERE id = ?").run(this.activeQueueId);
    db.prepare(
      "UPDATE panel_queue_items SET status = 'paused' WHERE queue_id = ? AND status = 'running'"
    ).run(this.activeQueueId);

    return this.getState();
  }

  resume(): QueueState {
    const db = getDb();

    // If no in-memory activeQueueId, try to find a paused queue from the DB
    // (handles server restarts where the singleton lost its state)
    if (!this.activeQueueId) {
      const paused = db
        .prepare("SELECT id FROM panel_queue WHERE status = 'paused' ORDER BY created_at DESC LIMIT 1")
        .get() as { id: number } | undefined;
      if (paused) {
        this.activeQueueId = paused.id;
      }
    }

    if (!this.activeQueueId) {
      throw new Error('No paused queue to resume');
    }

    const queue = db
      .prepare('SELECT status, confidence_threshold, force FROM panel_queue WHERE id = ?')
      .get(this.activeQueueId) as
      | { status: string; confidence_threshold: number; force: number }
      | undefined;

    if (queue?.status !== 'paused') {
      throw new Error('Queue is not paused');
    }

    // Update DB
    db.prepare("UPDATE panel_queue SET status = 'running' WHERE id = ?").run(this.activeQueueId);
    db.prepare(
      "UPDATE panel_queue_items SET status = 'pending' WHERE queue_id = ? AND status = 'paused'"
    ).run(this.activeQueueId);

    // Resume the JobManager if it's paused
    if (jobManager.isActive()) {
      try {
        jobManager.resume();
      } catch {
        // If JobManager isn't paused (e.g., server restarted), re-start the loop
      }
    }

    // If the processing loop isn't running (e.g., after server restart), restart it
    if (!this.processing) {
      this.loopPromise = this.processLoop(
        this.activeQueueId,
        queue.confidence_threshold,
        queue.force === 1
      ).catch((err) => {
        console.error('Queue processor fatal error on resume:', err);
        const errDb = getDb();
        errDb
          .prepare("UPDATE panel_queue SET status = 'error', completed_at = datetime('now') WHERE id = ?")
          .run(this.activeQueueId!);
        this.activeQueueId = null;
        this.processing = false;
      });
    }

    return this.getState();
  }

  cancel(): QueueState {
    const db = getDb();

    if (!this.activeQueueId) {
      const active = db
        .prepare("SELECT id FROM panel_queue WHERE status IN ('running', 'paused') ORDER BY created_at DESC LIMIT 1")
        .get() as { id: number } | undefined;
      if (active) {
        this.activeQueueId = active.id;
      }
    }

    if (!this.activeQueueId) {
      throw new Error('No active queue to cancel');
    }

    const queue = db
      .prepare('SELECT status FROM panel_queue WHERE id = ?')
      .get(this.activeQueueId) as { status: string } | undefined;

    if (!queue || (queue.status !== 'running' && queue.status !== 'paused')) {
      throw new Error('No active queue to cancel');
    }

    // Cancel the current volume in JobManager
    if (jobManager.isActive()) {
      try {
        jobManager.cancel();
      } catch {
        // JobManager might not be in a cancellable state
      }
    }

    // Update DB: cancel current item, skip remaining
    db.prepare(
      "UPDATE panel_queue_items SET status = 'cancelled' WHERE queue_id = ? AND status IN ('running', 'paused')"
    ).run(this.activeQueueId);
    db.prepare(
      "UPDATE panel_queue_items SET status = 'skipped' WHERE queue_id = ? AND status = 'pending'"
    ).run(this.activeQueueId);
    db.prepare(
      "UPDATE panel_queue SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?"
    ).run(this.activeQueueId);

    const state = this.getState();
    this.activeQueueId = null;
    this.processing = false;

    return state;
  }

  async restoreFromDb(): Promise<void> {
    const db = getDb();

    // Find an interrupted queue
    const queue = db
      .prepare(
        "SELECT id, status, confidence_threshold, force FROM panel_queue WHERE status IN ('running', 'paused') ORDER BY created_at DESC LIMIT 1"
      )
      .get() as
      | { id: number; status: string; confidence_threshold: number; force: number }
      | undefined;

    if (!queue) return;

    this.activeQueueId = queue.id;

    // Fix any items that were 'running' when the server crashed — reset to 'pending'
    // so the processLoop picks them up (page-level skip handles resume)
    db.prepare(
      "UPDATE panel_queue_items SET status = 'pending' WHERE queue_id = ? AND status = 'running'"
    ).run(queue.id);

    // Always pause interrupted queues on restart — auto-resuming saturates CPU
    // and starves web requests. The user can resume manually when ready.
    db.prepare("UPDATE panel_queue SET status = 'paused' WHERE id = ?").run(queue.id);
    db.prepare(
      "UPDATE panel_queue_items SET status = 'pending' WHERE queue_id = ? AND status IN ('paused', 'running')"
    ).run(queue.id);
    console.log(`Restored panel queue ${queue.id} as paused — resume manually when ready`);
  }

  private async processLoop(
    queueId: number,
    confidenceThreshold: number,
    force: boolean
  ): Promise<void> {
    this.processing = true;
    const db = getDb();

    // Mark queue as running
    db.prepare(
      "UPDATE panel_queue SET status = 'running', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?"
    ).run(queueId);

    while (true) {
      // Check if cancelled
      const queue = db
        .prepare('SELECT status FROM panel_queue WHERE id = ?')
        .get(queueId) as { status: string } | undefined;

      if (!queue || queue.status === 'cancelled') break;

      // Wait if paused
      if (queue.status === 'paused') {
        // Exit the loop — resume() will restart it
        this.processing = false;
        return;
      }

      // Get next pending item
      const nextItem = db
        .prepare(
          "SELECT id, volume_id FROM panel_queue_items WHERE queue_id = ? AND status = 'pending' ORDER BY sort_order LIMIT 1"
        )
        .get(queueId) as { id: number; volume_id: number } | undefined;

      if (!nextItem) {
        // All items processed
        db.prepare(
          "UPDATE panel_queue SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
        ).run(queueId);
        break;
      }

      // Mark item as running
      db.prepare(
        "UPDATE panel_queue_items SET status = 'running', started_at = datetime('now') WHERE id = ?"
      ).run(nextItem.id);

      try {
        // Delegate to JobManager
        await jobManager.start(nextItem.volume_id, confidenceThreshold, force);

        // Poll until JobManager finishes this volume
        await this.awaitJobCompletion();

        const finalState = jobManager.getState();

        // Update item as completed
        db.prepare(
          `UPDATE panel_queue_items
           SET status = 'completed',
               total_pages = ?,
               processed_pages = ?,
               current_page = ?,
               completed_at = datetime('now')
           WHERE id = ?`
        ).run(
          finalState.totalPages,
          finalState.processedPages,
          finalState.currentPage,
          nextItem.id
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Queue item ${nextItem.id} (volume ${nextItem.volume_id}) failed:`, errorMsg);

        db.prepare(
          `UPDATE panel_queue_items
           SET status = 'error', error = ?, completed_at = datetime('now')
           WHERE id = ?`
        ).run(errorMsg, nextItem.id);
      }
    }

    this.processing = false;
    this.activeQueueId = null;
  }

  private awaitJobCompletion(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!jobManager.isActive()) {
          resolve();
          return;
        }
        setTimeout(check, 500);
      };
      check();
    });
  }
}

// Module-level singleton
export const queueProcessor = new QueueProcessor();
