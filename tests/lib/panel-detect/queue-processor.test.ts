import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '@/lib/db';

// A mutable holder the hoisted db mock reads from, swapped to a fresh in-memory
// database in each test for isolation.
const holder = vi.hoisted(() => ({ db: null as unknown as import('better-sqlite3').Database }));

// Job manager / ONNX session are external collaborators that do real inference
// work; mock them so the queue processor's transitions can be tested in isolation.
const mocks = vi.hoisted(() => ({
  jobIsActive: vi.fn<() => boolean>(() => false),
  jobStart: vi.fn<(...a: unknown[]) => Promise<void>>(async () => {}),
  jobGetState: vi.fn(() => ({ totalPages: 0, processedPages: 0, currentPage: 0 })),
  jobCancel: vi.fn(),
  jobPause: vi.fn(),
  jobResume: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getDb: () => holder.db };
});

vi.mock('@/lib/panel-detect/job-manager', () => ({
  jobManager: {
    isActive: () => mocks.jobIsActive(),
    start: (...a: unknown[]) => mocks.jobStart(...a),
    getState: () => mocks.jobGetState(),
    cancel: () => mocks.jobCancel(),
    pause: () => mocks.jobPause(),
    resume: () => mocks.jobResume(),
  },
}));

vi.mock('@/lib/panel-detect/onnx-session', () => ({
  scheduleSessionRelease: vi.fn(),
  cancelScheduledRelease: vi.fn(),
}));

type QueueProcessorModule = typeof import('@/lib/panel-detect/queue-processor');
let queueProcessor: QueueProcessorModule['queueProcessor'];

function seedSeriesAndVolumes() {
  holder.db.prepare("INSERT INTO series (id, title, folder_name) VALUES (1, 'S', 'S')").run();
  const insert = holder.db.prepare(
    "INSERT INTO volumes (id, series_id, title, filename, volume_number, page_count, format) VALUES (?, 1, ?, ?, ?, 10, 'pdf')",
  );
  insert.run(1, 'V1', 'V1.pdf', 1);
  insert.run(2, 'V2', 'V2.pdf', 2);
}

function insertQueue(status: string): number {
  const r = holder.db
    .prepare("INSERT INTO panel_queue (series_id, status, confidence_threshold, force) VALUES (1, ?, 0.25, 0)")
    .run(status);
  return r.lastInsertRowid as number;
}

function insertItem(queueId: number, volumeId: number, sortOrder: number, status: string) {
  holder.db
    .prepare(
      'INSERT INTO panel_queue_items (queue_id, volume_id, sort_order, status) VALUES (?, ?, ?, ?)',
    )
    .run(queueId, volumeId, sortOrder, status);
}

function itemStatuses(queueId: number): string[] {
  return (
    holder.db
      .prepare('SELECT status FROM panel_queue_items WHERE queue_id = ? ORDER BY sort_order')
      .all(queueId) as { status: string }[]
  ).map((r) => r.status);
}

function queueStatus(queueId: number): string {
  return (holder.db.prepare('SELECT status FROM panel_queue WHERE id = ?').get(queueId) as {
    status: string;
  }).status;
}

beforeEach(async () => {
  holder.db = new Database(':memory:');
  holder.db.exec(SCHEMA_SQL);
  seedSeriesAndVolumes();

  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.jobIsActive.mockReturnValue(false);
  mocks.jobStart.mockResolvedValue(undefined);
  mocks.jobGetState.mockReturnValue({ totalPages: 0, processedPages: 0, currentPage: 0 });

  // Fresh module graph → fresh singleton, so private state never leaks between tests.
  vi.resetModules();
  ({ queueProcessor } = await import('@/lib/panel-detect/queue-processor'));
});

describe('queueProcessor.restoreFromDb', () => {
  it('forces an interrupted running queue to paused and resets running items to pending', async () => {
    const queueId = insertQueue('running');
    insertItem(queueId, 1, 0, 'running');
    insertItem(queueId, 2, 1, 'pending');

    await queueProcessor.restoreFromDb();

    expect(queueStatus(queueId)).toBe('paused');
    expect(itemStatuses(queueId)).toEqual(['pending', 'pending']);
  });
});

describe('queueProcessor.cancel', () => {
  it('cancels the running item, skips remaining pending items, and leaves completed ones', () => {
    const queueId = insertQueue('running');
    insertItem(queueId, 1, 0, 'completed');
    insertItem(queueId, 2, 1, 'running');
    holder.db
      .prepare(
        "INSERT INTO panel_queue_items (queue_id, volume_id, sort_order, status) VALUES (?, 2, 2, 'pending')",
      )
      .run(queueId);

    queueProcessor.cancel();

    expect(queueStatus(queueId)).toBe('cancelled');
    expect(itemStatuses(queueId)).toEqual(['completed', 'cancelled', 'skipped']);
  });
});

describe('queueProcessor lifecycle guards', () => {
  it('pause throws when no queue is running', () => {
    expect(() => queueProcessor.pause()).toThrow(/no running queue/i);
  });

  it('resume throws when no queue is paused', () => {
    expect(() => queueProcessor.resume()).toThrow(/no paused queue/i);
  });

  it('cancel throws when no queue is active', () => {
    expect(() => queueProcessor.cancel()).toThrow(/no active queue/i);
  });

  it('rejects creating a second queue while one is active', async () => {
    // Make the job hang so the processing loop parks with the queue active.
    mocks.jobStart.mockReturnValue(new Promise<void>(() => {}));

    await queueProcessor.create(1, [1], 0.25, false);

    await expect(queueProcessor.create(1, [2], 0.25, false)).rejects.toThrow(/already active/i);
  });
});
