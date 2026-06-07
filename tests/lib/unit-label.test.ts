import { describe, it, expect } from 'vitest';
import { unitNoun, unitAbbrev, unitLabel, endOfUnitLabel } from '@/lib/unit-label';

describe('unit-label volume branch (must match pre-chapter wording)', () => {
  it('uses the historical "Vol." / "Volume" wording', () => {
    expect(unitNoun('volume')).toBe('Volume');
    expect(unitAbbrev('volume')).toBe('Vol.');
    expect(unitLabel('volume', 3)).toBe('Vol. 3');
    expect(endOfUnitLabel('volume')).toBe('End of Volume');
  });

  it('falls back to a bare "#" placeholder when the number is null', () => {
    expect(unitLabel('volume', null)).toBe('#');
    expect(unitLabel('volume', undefined)).toBe('#');
  });
});

describe('unit-label chapter branch', () => {
  it('uses "Ch." / "Chapter" wording and preserves decimals', () => {
    expect(unitNoun('chapter')).toBe('Chapter');
    expect(unitAbbrev('chapter')).toBe('Ch.');
    expect(unitLabel('chapter', 10.5)).toBe('Ch. 10.5');
    expect(endOfUnitLabel('chapter')).toBe('End of Chapter');
  });

  it('falls back to "#" when the number is null', () => {
    expect(unitLabel('chapter', null)).toBe('#');
  });
});
