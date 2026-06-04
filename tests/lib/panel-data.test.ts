import { describe, it, expect, vi } from 'vitest';

// The validation guards must reject before any DB access. Mock getDb to throw so
// that a leaked call past the guards fails loudly rather than silently opening a DB.
vi.mock('@/lib/db', () => ({
  getDb: () => {
    throw new Error('getDb should not be called when validation fails');
  },
}));

import { insertPanelData } from '@/lib/panel-data';
import type { Panel } from '@/lib/panel-detect/types';

const VALID_PANELS: Panel[] = [
  { id: 'p1', readingOrder: 0, x: 0, y: 0, width: 0.5, height: 0.5, confidence: 1 },
];

describe('insertPanelData validation guards', () => {
  it('rejects a non-positive volumeId', () => {
    expect(() => insertPanelData(0, 1, VALID_PANELS, null, 'panels', 1, 0.25)).toThrow(
      /volume_id/,
    );
  });

  it('rejects a non-integer volumeId', () => {
    expect(() => insertPanelData(1.5, 1, VALID_PANELS, null, 'panels', 1, 0.25)).toThrow(
      /volume_id/,
    );
  });

  it('rejects a non-positive pageNumber', () => {
    expect(() => insertPanelData(1, 0, VALID_PANELS, null, 'panels', 1, 0.25)).toThrow(
      /page_number/,
    );
  });

  it('rejects a non-integer pageNumber', () => {
    expect(() => insertPanelData(1, 2.5, VALID_PANELS, null, 'panels', 1, 0.25)).toThrow(
      /page_number/,
    );
  });

  it('rejects panels that are not an array', () => {
    // @ts-expect-error -- intentionally passing the wrong type to exercise the guard
    expect(() => insertPanelData(1, 1, 'not-an-array', null, 'panels', 1, 0.25)).toThrow(
      /panels must be an array/,
    );
  });
});
