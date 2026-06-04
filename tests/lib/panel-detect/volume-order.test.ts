import { describe, it, expect } from 'vitest';
import { compareVolumeOrder } from '@/lib/panel-detect/volume-order';

describe('compareVolumeOrder', () => {
  it('orders numbered volumes ascending with nulls last', () => {
    const volumes = [
      { id: 'a', volume_number: 3 },
      { id: 'b', volume_number: null },
      { id: 'c', volume_number: 1 },
      { id: 'd', volume_number: 2 },
      { id: 'e', volume_number: null },
    ];

    const ordered = [...volumes].sort(compareVolumeOrder).map((v) => v.id);

    // Numbered volumes ascending first, null-numbered volumes after them.
    expect(ordered.slice(0, 3)).toEqual(['c', 'd', 'a']);
    expect(ordered.slice(3).sort()).toEqual(['b', 'e']);
  });

  it('treats two nulls as equal', () => {
    expect(compareVolumeOrder({ volume_number: null }, { volume_number: null })).toBe(0);
  });

  it('sorts a null after a number regardless of argument order', () => {
    expect(compareVolumeOrder({ volume_number: null }, { volume_number: 5 })).toBeGreaterThan(0);
    expect(compareVolumeOrder({ volume_number: 5 }, { volume_number: null })).toBeLessThan(0);
  });
});
