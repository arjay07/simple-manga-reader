import { describe, it, expect } from 'vitest';
import { computeStopGeometry } from '@/lib/reader/panel-zoom';
import type { Panel } from '@/lib/panel-detect/types';

function panel(p: Partial<Panel>): Panel {
  return { id: 'p', readingOrder: 0, x: 0, y: 0, width: 0.5, height: 0.5, confidence: 1, ...p };
}

// A representative viewport / canvas. Canvas is larger than the viewport (a page
// rendered at higher res than the screen), which is the normal reader condition.
const VW = 800;
const VH = 1200;
const CW = 1000;
const CH = 1500;

describe('computeStopGeometry', () => {
  it('returns a single stop for a tall panel readable at fit-zoom', () => {
    const g = computeStopGeometry(panel({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 }), VW, VH, CW, CH);
    expect(g.stopCount).toBe(1);
    expect(g.zoom).toBeLessThanOrEqual(5);
    expect(g.zoom).toBeGreaterThan(0);
  });

  it('returns multiple stops for a wide, short strip', () => {
    const g = computeStopGeometry(
      panel({ x: 0.3, y: 0.47, width: 0.36, height: 0.05 }),
      VW,
      VH,
      CW,
      CH,
    );
    expect(g.stopCount).toBe(2);
    // Multi-stop zoom is capped at 3.5x.
    expect(g.zoom).toBeCloseTo(3.5, 5);
  });

  it('caps the stop count and zoom for an extremely wide strip', () => {
    const g = computeStopGeometry(
      panel({ x: 0.05, y: 0.45, width: 0.9, height: 0.1 }),
      VW,
      VH,
      CW,
      CH,
    );
    // fitZoom < 1.5 here, so the cap is 4 stops.
    expect(g.stopCount).toBe(4);
    expect(g.zoom).toBeGreaterThan(1);
    expect(g.zoom).toBeLessThanOrEqual(3.5);
  });

  it('keeps the inset rect within page bounds and zoom within caps across many panels', () => {
    const widths = [0.1, 0.3, 0.5, 0.7, 0.95];
    const heights = [0.05, 0.15, 0.4, 0.7, 0.95];
    for (const width of widths) {
      for (const height of heights) {
        const x = (1 - width) / 2;
        const y = (1 - height) / 2;
        const g = computeStopGeometry(panel({ x, y, width, height }), VW, VH, CW, CH);

        // Inset rect never leaves the normalized page.
        expect(g.px).toBeGreaterThanOrEqual(0);
        expect(g.py).toBeGreaterThanOrEqual(0);
        expect(g.px + g.pw).toBeLessThanOrEqual(1 + 1e-9);
        expect(g.py + g.ph).toBeLessThanOrEqual(1 + 1e-9);

        // Zoom never exceeds the single-stop hard cap (5) and is positive.
        expect(g.zoom).toBeGreaterThan(0);
        expect(g.zoom).toBeLessThanOrEqual(5);

        // Multi-stop results are capped tighter, at 3.5x and at most 4 stops.
        expect(g.stopCount).toBeGreaterThanOrEqual(1);
        if (g.stopCount > 1) {
          expect(g.zoom).toBeLessThanOrEqual(3.5 + 1e-9);
          expect(g.stopCount).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});
