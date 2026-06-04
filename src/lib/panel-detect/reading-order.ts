import type { RawPanel, Panel, ReadingTreeNode } from './types';
import {
  type PanelDetectConfig,
  type ReadingOrderConfig,
  DEFAULT_PANEL_DETECT_CONFIG,
} from './config';

interface PanelWithId extends RawPanel {
  id: string;
}

interface OrderResult {
  panels: Panel[];
  readingTree: ReadingTreeNode | null;
}

/**
 * Assign RTL manga reading order to raw detected panels.
 *
 * Strategy: recursive XY-cut (binary space partition). At each step we look for
 * a clean "gutter" — a full-span gap that separates the panels into two groups
 * with nothing straddling it:
 *
 *   1. Prefer a HORIZONTAL gutter (a full-width gap). Manga reads row by row,
 *      so the group above the gutter is read entirely before the group below.
 *   2. Otherwise look for a VERTICAL gutter (a full-height gap). RTL: the group
 *      to the RIGHT of the gutter is read entirely before the group to the left.
 *   3. If no clean gutter exists (overlapping / interlocking boxes), fall back
 *      to a centre-of-mass split on whichever axis is more separated.
 *
 * Each group recurses independently, so a tall panel that spans several rows of
 * its neighbours naturally reads as its own column rather than being forced into
 * a single row with panels it doesn't actually sit beside. This is what fixes
 * the 3-column "tall middle panel" layout (right column top-to-bottom, then the
 * tall middle, then the left column top-to-bottom).
 *
 * The recursion also IS the reading tree — the same vertical/horizontal cuts are
 * the {@link ReadingTreeNode} branches, so order and tree never disagree.
 */
export function assignReadingOrder(
  rawPanels: RawPanel[],
  config: PanelDetectConfig = DEFAULT_PANEL_DETECT_CONFIG,
): OrderResult {
  const ro = config.readingOrder;
  if (rawPanels.length === 0) {
    return { panels: [], readingTree: null };
  }

  const panels: PanelWithId[] = rawPanels.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
  }));

  const orderedIds: string[] = [];
  const tree = xyCut(panels, ro, orderedIds);

  const orderById = new Map(orderedIds.map((id, i) => [id, i + 1]));
  const result: Panel[] = panels
    .map((p) => ({ ...p, readingOrder: orderById.get(p.id)! }))
    .sort((a, b) => a.readingOrder - b.readingOrder);

  return { panels: result, readingTree: tree };
}

type Axis = 'x' | 'y';

const lo = (p: RawPanel, axis: Axis): number => (axis === 'x' ? p.x : p.y);
const hi = (p: RawPanel, axis: Axis): number =>
  axis === 'x' ? p.x + p.width : p.y + p.height;
const center = (p: RawPanel, axis: Axis): number => lo(p, axis) + (hi(p, axis) - lo(p, axis)) / 2;

interface Split {
  /** Panels with the smaller coordinate (top for 'y', left for 'x'). */
  first: PanelWithId[];
  /** Panels with the larger coordinate (bottom for 'y', right for 'x'). */
  second: PanelWithId[];
  /** Normalised position of the cut line. */
  at: number;
}

/**
 * Recursively cut a group of panels and append leaf ids to `out` in reading
 * order, returning the reading tree for the group.
 */
function xyCut(panels: PanelWithId[], ro: ReadingOrderConfig, out: string[]): ReadingTreeNode {
  if (panels.length === 1) {
    out.push(panels[0].id);
    return { panel: panels[0].id };
  }

  // Prefer a clean horizontal gutter: manga reads row by row, top group first.
  const h = cleanGutter(panels, 'y', ro.gutterTolerance);
  if (h) {
    return {
      cut: 'horizontal',
      at: h.at,
      top: xyCut(h.first, ro, out),
      bottom: xyCut(h.second, ro, out),
    };
  }

  // Otherwise a clean vertical gutter: RTL, right group first.
  const v = cleanGutter(panels, 'x', ro.gutterTolerance);
  if (v) {
    return {
      cut: 'vertical',
      at: v.at,
      right: xyCut(v.second, ro, out),
      left: xyCut(v.first, ro, out),
    };
  }

  // No clean gutter (overlapping boxes): split on the more separated axis.
  return fallbackCut(panels, ro, out);
}

/**
 * Find the widest clean gutter along `axis`, or null if none exists.
 *
 * A clean gutter splits the group (sorted by leading edge) into a prefix and a
 * suffix such that every prefix panel ends before every suffix panel begins —
 * i.e. nothing straddles the cut line. Detector boxes are loose, so panels may
 * overlap across the line by up to `tolerance` (a fraction of the normalised
 * page extent) and the gutter still counts as clean.
 */
function cleanGutter(panels: PanelWithId[], axis: Axis, tolerance: number): Split | null {
  const sorted = [...panels].sort((a, b) => lo(a, axis) - lo(b, axis));

  let maxHi = hi(sorted[0], axis);
  let best: { idx: number; gap: number; at: number } | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const gap = lo(sorted[i], axis) - maxHi;
    if (gap >= -tolerance && (best === null || gap > best.gap)) {
      best = { idx: i, gap, at: (maxHi + lo(sorted[i], axis)) / 2 };
    }
    maxHi = Math.max(maxHi, hi(sorted[i], axis));
  }

  if (!best) return null;
  return { first: sorted.slice(0, best.idx), second: sorted.slice(best.idx), at: best.at };
}

/**
 * Last-resort split when no clean gutter exists: cut at the largest gap between
 * panel centres, on whichever axis is more separated. Horizontal wins ties
 * (read rows before columns). Guarantees a non-empty split on both sides so the
 * recursion always terminates.
 */
function fallbackCut(panels: PanelWithId[], ro: ReadingOrderConfig, out: string[]): ReadingTreeNode {
  const byY = centerGap(panels, 'y');
  const byX = centerGap(panels, 'x');

  if (byY.gap > 0 && byY.gap >= byX.gap) {
    return {
      cut: 'horizontal',
      at: byY.at,
      top: xyCut(byY.first, ro, out),
      bottom: xyCut(byY.second, ro, out),
    };
  }
  if (byX.gap > 0) {
    return {
      cut: 'vertical',
      at: byX.at,
      right: xyCut(byX.second, ro, out),
      left: xyCut(byX.first, ro, out),
    };
  }

  // Degenerate: all centres coincide on both axes. Split positionally so the
  // recursion still terminates (top-to-bottom, then right-to-left within a tie).
  const sorted = [...panels].sort((a, b) => a.y - b.y || b.x - a.x);
  const mid = Math.floor(sorted.length / 2);
  const top = sorted.slice(0, mid);
  const bottom = sorted.slice(mid);
  return {
    cut: 'horizontal',
    at: (hi(top[top.length - 1], 'y') + lo(bottom[0], 'y')) / 2,
    top: xyCut(top, ro, out),
    bottom: xyCut(bottom, ro, out),
  };
}

/** Split at the largest gap between panel centres along `axis`. */
function centerGap(panels: PanelWithId[], axis: Axis): Split & { gap: number } {
  const sorted = [...panels].sort((a, b) => center(a, axis) - center(b, axis));
  let bestIdx = 1;
  let bestGap = -Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const gap = center(sorted[i], axis) - center(sorted[i - 1], axis);
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = i;
    }
  }
  const at = (center(sorted[bestIdx - 1], axis) + center(sorted[bestIdx], axis)) / 2;
  return { first: sorted.slice(0, bestIdx), second: sorted.slice(bestIdx), at, gap: bestGap };
}
