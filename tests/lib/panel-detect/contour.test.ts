import { describe, it, expect } from 'vitest';
import {
  findGutters,
  horizontalProjection,
  verticalProjection,
  findPanels,
  type Region,
} from '@/lib/panel-detect/contour';
import { DEFAULT_PANEL_DETECT_CONFIG } from '@/lib/panel-detect/config';

const CONTOUR = DEFAULT_PANEL_DETECT_CONFIG.contour;

const WHITE = 255;
const BLACK = 0;

/**
 * Build a raw grayscale buffer (0 = content, 255 = gutter) by calling `fill`
 * for each pixel. Width-major, row-major: index = y * width + x.
 */
function buildBuffer(width: number, height: number, fill: (x: number, y: number) => number): Uint8Array {
  const buf = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[y * width + x] = fill(x, y);
    }
  }
  return buf;
}

describe('findGutters', () => {
  it('detects a centred run of white as a gutter', () => {
    const projection = new Array(100).fill(0);
    for (let i = 40; i < 60; i++) projection[i] = 1.0;

    const gutters = findGutters(projection, 100, 5, 0.85);

    expect(gutters).toHaveLength(1);
    expect(gutters[0].center).toBe(50);
  });

  it('excludes a white run that sits within the edge margin', () => {
    const projection = new Array(100).fill(0);
    // edgeMargin = 100 * 0.03 = 3; a run at the very start has center 2 < 3.
    for (let i = 0; i < 4; i++) projection[i] = 1.0;

    const gutters = findGutters(projection, 100, 3, 0.85);

    expect(gutters).toHaveLength(0);
  });

  it('ignores runs narrower than minWidth', () => {
    const projection = new Array(100).fill(0);
    for (let i = 48; i < 50; i++) projection[i] = 1.0; // width 2

    expect(findGutters(projection, 100, 5, 0.85)).toHaveLength(0);
  });
});

describe('projections', () => {
  it('horizontalProjection reports the white fraction per row', () => {
    // Top half all white, bottom half all black.
    const width = 10;
    const height = 4;
    const pixels = buildBuffer(width, height, (_x, y) => (y < 2 ? WHITE : BLACK));
    const region: Region = { x: 0, y: 0, width, height };

    expect(horizontalProjection(pixels, width, region)).toEqual([1, 1, 0, 0]);
  });

  it('verticalProjection reports the white fraction per column', () => {
    // Left half all white, right half all black.
    const width = 4;
    const height = 10;
    const pixels = buildBuffer(width, height, (x) => (x < 2 ? WHITE : BLACK));
    const region: Region = { x: 0, y: 0, width, height };

    expect(verticalProjection(pixels, width, region)).toEqual([1, 1, 0, 0]);
  });
});

describe('findPanels', () => {
  it('splits a buffer with two content blocks separated by a white gutter into two regions', () => {
    const width = 120;
    const height = 40;
    // Content (black) on the left and right, a white vertical gutter down the middle.
    const pixels = buildBuffer(width, height, (x) => (x >= 50 && x < 70 ? WHITE : BLACK));
    const fullRegion: Region = { x: 0, y: 0, width, height };

    const regions = findPanels(pixels, width, height, fullRegion, CONTOUR);

    expect(regions).toHaveLength(2);
    // One region on each side of the gutter centre (~60).
    const sorted = [...regions].sort((a, b) => a.x - b.x);
    expect(sorted[0].x).toBeLessThan(60);
    expect(sorted[1].x + sorted[1].width).toBeGreaterThan(60);
  });

  it('returns the whole region when there is no gutter', () => {
    const width = 60;
    const height = 40;
    const pixels = buildBuffer(width, height, () => BLACK); // solid content, no gutters
    const fullRegion: Region = { x: 0, y: 0, width, height };

    const regions = findPanels(pixels, width, height, fullRegion, CONTOUR);

    expect(regions).toEqual([fullRegion]);
  });
});
