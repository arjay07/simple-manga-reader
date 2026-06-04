import { describe, it, expect } from 'vitest';
import { classifyPageType, FULL_BLEED_AREA_THRESHOLD } from '@/lib/panel-detect/classify';
import type { RawPanel } from '@/lib/panel-detect/types';

function panel(width: number, height: number): RawPanel {
  return { x: 0, y: 0, width, height, confidence: 1 };
}

describe('classifyPageType', () => {
  it('classifies no panels as blank', () => {
    expect(classifyPageType([])).toBe('blank');
  });

  it('classifies a single full-page panel as full-bleed at the threshold', () => {
    // area exactly at the threshold counts as full-bleed (>=)
    expect(classifyPageType([panel(1, FULL_BLEED_AREA_THRESHOLD)])).toBe('full-bleed');
  });

  it('classifies a single large panel above the threshold as full-bleed', () => {
    expect(classifyPageType([panel(1, 0.95)])).toBe('full-bleed');
  });

  it('classifies a single panel just below the threshold as cover', () => {
    expect(classifyPageType([panel(1, 0.89)])).toBe('cover');
  });

  it('classifies a small single panel as cover', () => {
    expect(classifyPageType([panel(0.5, 0.5)])).toBe('cover');
  });

  it('classifies multiple panels as panels', () => {
    expect(classifyPageType([panel(0.5, 0.5), panel(0.5, 0.5)])).toBe('panels');
  });
});
