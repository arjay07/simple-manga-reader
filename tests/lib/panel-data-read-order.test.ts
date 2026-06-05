import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '@/lib/db';
import type { Panel, ReadingTreeNode } from '@/lib/panel-detect/types';

// A mutable holder the hoisted db mock reads from, swapped to a fresh in-memory
// database in each test for isolation.
const holder = vi.hoisted(() => ({ db: null as unknown as import('better-sqlite3').Database }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getDb: () => holder.db };
});

// A swappable ordering implementation so a test can substitute a different
// algorithm and prove the read re-derives from it (rather than the stored order).
const orderImpl = vi.hoisted(() => ({
  fn: null as
    | null
    | ((...args: unknown[]) => { panels: Panel[]; readingTree: ReadingTreeNode | null }),
}));

vi.mock('@/lib/panel-detect/reading-order', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const real = actual.assignReadingOrder as (...args: unknown[]) => unknown;
  return {
    ...actual,
    assignReadingOrder: (...args: unknown[]) => (orderImpl.fn ?? real)(...args),
  };
});

import {
  insertPanelData,
  getPanelDataForPage,
  getPanelDataForVolume,
  getPanelDataForPages,
} from '@/lib/panel-data';

// Two full-height panels side by side. RTL: the RIGHT panel (higher x) reads
// first. Stored readingOrder below is deliberately the WRONG (LTR) order.
const LEFT: Panel = { id: 'stored-left', readingOrder: 1, x: 0, y: 0, width: 0.45, height: 1, confidence: 0.9 }; // prettier-ignore
const RIGHT: Panel = { id: 'stored-right', readingOrder: 2, x: 0.55, y: 0, width: 0.45, height: 1, confidence: 0.8 }; // prettier-ignore

/** Collect every panel id referenced by the reading tree's leaves. */
function leafIds(node: ReadingTreeNode | null): string[] {
  if (!node) return [];
  if ('panel' in node) return [node.panel];
  return [node.top, node.bottom, node.left, node.right]
    .filter((c): c is ReadingTreeNode => Boolean(c))
    .flatMap(leafIds);
}

function seedVolume() {
  holder.db.prepare("INSERT INTO series (id, title, folder_name) VALUES (1, 'S', 'S')").run();
  holder.db
    .prepare(
      "INSERT INTO volumes (id, series_id, title, filename, volume_number, page_count, format) VALUES (1, 1, 'V1', 'V1.pdf', 1, 10, 'pdf')",
    )
    .run();
}

beforeEach(() => {
  holder.db = new Database(':memory:');
  holder.db.exec(SCHEMA_SQL);
  seedVolume();
  orderImpl.fn = null;
});

afterEach(() => {
  orderImpl.fn = null;
  holder.db.close();
});

describe('panel-data read-time order derivation', () => {
  it('2.1 re-derives order from geometry, ignoring the stored (wrong) order', () => {
    // Store with LEFT first / RIGHT second — the wrong RTL order on purpose.
    insertPanelData(1, 1, [LEFT, RIGHT], { panel: 'stored-left' }, 'panels', 5, 0.25);

    const page = getPanelDataForPage(1, 1)!;
    expect(page).not.toBeNull();

    // The current algorithm reads the RIGHT (higher-x) panel first.
    const first = page.panels.find((p) => p.readingOrder === 1)!;
    const second = page.panels.find((p) => p.readingOrder === 2)!;
    expect(first.x).toBeCloseTo(RIGHT.x);
    expect(second.x).toBeCloseTo(LEFT.x);

    // Geometry is preserved verbatim for both boxes.
    expect(first.width).toBeCloseTo(RIGHT.width);
    expect(first.height).toBeCloseTo(RIGHT.height);
    expect(first.confidence).toBeCloseTo(RIGHT.confidence);
    expect(second.width).toBeCloseTo(LEFT.width);
    expect(second.confidence).toBeCloseTo(LEFT.confidence);
  });

  it('2.2 reflects an ordering-algorithm change on the next read with no re-insert', () => {
    insertPanelData(1, 1, [LEFT, RIGHT], { panel: 'stored-left' }, 'panels', 5, 0.25);

    // Real algorithm: RIGHT first.
    const before = getPanelDataForPage(1, 1)!;
    expect(before.panels.find((p) => p.readingOrder === 1)!.x).toBeCloseTo(RIGHT.x);

    // Swap in a different ordering (LTR) — no re-insert, no rewrite of the row.
    orderImpl.fn = (...args: unknown[]) => {
      const raw = args[0] as Array<Omit<Panel, 'id' | 'readingOrder'>>;
      const ltr = [...raw].sort((a, b) => a.x - b.x);
      const panels: Panel[] = ltr.map((p, i) => ({
        ...p,
        id: `p${i + 1}`,
        readingOrder: i + 1,
      }));
      return { panels, readingTree: { panel: 'p1' } };
    };

    const after = getPanelDataForPage(1, 1)!;
    // Now the LEFT panel reads first — the read followed the new algorithm.
    expect(after.panels.find((p) => p.readingOrder === 1)!.x).toBeCloseTo(LEFT.x);

    // The stored row is untouched: clearing the stub restores the real order.
    orderImpl.fn = null;
    const restored = getPanelDataForPage(1, 1)!;
    expect(restored.panels.find((p) => p.readingOrder === 1)!.x).toBeCloseTo(RIGHT.x);
  });

  it('2.3 holds structural invariants across all three read paths', () => {
    insertPanelData(1, 1, [LEFT, RIGHT], { panel: 'stored-left' }, 'panels', 5, 0.25);

    const fromPage = getPanelDataForPage(1, 1)!;
    const fromVolume = getPanelDataForVolume(1)[0];
    const fromPages = getPanelDataForPages(1, [1])[0];

    for (const page of [fromPage, fromVolume, fromPages]) {
      const orders = page.panels.map((p) => p.readingOrder).sort((a, b) => a - b);
      expect(orders).toEqual([1, 2]); // contiguous 1..N

      const ids = page.panels.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length); // ids unique

      // Reading tree references exactly the returned ids.
      expect(leafIds(page.readingTree).sort()).toEqual([...ids].sort());
    }
  });

  it('2.3 empty panels_json yields zero panels and a null tree', () => {
    insertPanelData(1, 2, [], null, 'blank', 1, 0.25);

    const page = getPanelDataForPage(1, 2)!;
    expect(page.panels).toEqual([]);
    expect(page.readingTree).toBeNull();
  });
});
