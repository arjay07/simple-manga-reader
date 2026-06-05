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
 * Strategy: recursive XY-cut (binary space partition). At each step we score
 * every candidate cut line and take the best *separating* one:
 *
 *   1. Prefer a HORIZONTAL cut (a full-width split). Manga reads row by row,
 *      so the group above the cut is read entirely before the group below.
 *   2. Otherwise take a VERTICAL cut (a full-height split). RTL: the group to
 *      the RIGHT of the cut is read entirely before the group to the left.
 *   3. If no valid cut exists on either axis (genuinely interlocking boxes),
 *      emit the region in deterministic geometric order so recursion terminates.
 *
 * A candidate cut is scored by how much it straddles panels, measured *relative
 * to each panel's own extent* on the cut axis (see {@link bestValidCut}): a cut
 * is valid only when no panel is clipped by more than `maxStraddleRatio` of its
 * own size, and a straddled panel snaps to the side holding the majority of its
 * area. This subsumes the old clean-gutter test (a perfectly clean gutter is
 * just the zero-straddle case) and the old centre-of-mass fallback, so a panel
 * poking slightly across a row boundary no longer forces a fragile guess.
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
const hi = (p: RawPanel, axis: Axis): number => (axis === 'x' ? p.x + p.width : p.y + p.height);

/** Float-comparison slack for ranking cuts and for treating a near-zero
 * straddle as clean. */
const EPS = 1e-9;

interface Cut {
  /** Panels on the smaller-coordinate side (top for 'y', left for 'x'). */
  first: PanelWithId[];
  /** Panels on the larger-coordinate side (bottom for 'y', right for 'x'). */
  second: PanelWithId[];
  /** Largest fraction any single panel is clipped by this cut (0 = clean). */
  maxClipped: number;
  /** Signed gutter width at the cut: positive = a real gap, negative =
   * boxes overlap across the line. Used only as a tie-break (wider is better). */
  gap: number;
  /** Normalised position of the cut line (the gutter midpoint). */
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

  // Prefer the least-straddle horizontal cut: manga reads row by row, top first.
  const h = bestValidCut(panels, 'y', ro.maxStraddleRatio);
  if (h) {
    return {
      cut: 'horizontal',
      at: h.at,
      top: xyCut(h.first, ro, out),
      bottom: xyCut(h.second, ro, out),
    };
  }

  // Otherwise the least-straddle vertical cut: RTL, right group first.
  const v = bestValidCut(panels, 'x', ro.maxStraddleRatio);
  if (v) {
    return {
      cut: 'vertical',
      at: v.at,
      right: xyCut(v.second, ro, out),
      left: xyCut(v.first, ro, out),
    };
  }

  // Genuinely inseparable region (mutual overlap, no dominant axis): emit in
  // deterministic geometric order so the recursion still terminates.
  return inseparable(panels, ro, out);
}

/**
 * Evaluate a candidate cut at position `p` on `axis`.
 *
 * Each panel's interval `[lo, hi]` is classified against `p`:
 *   - `hi <= p`  → fully before the cut → `first`.
 *   - `lo >= p`  → fully after the cut  → `second`.
 *   - otherwise it straddles: `portionLow = (p - lo) / (hi - lo)`; the panel is
 *     clipped by `min(portionLow, 1 - portionLow)` of its own extent and snaps
 *     to the side holding the majority of its area (`portionLow > 0.5 → first`).
 *
 * Returns the partition, the largest per-panel clipped fraction, the signed
 * gutter width, and the gutter-midpoint position.
 */
function evaluateCut(panels: PanelWithId[], axis: Axis, p: number): Cut {
  const first: PanelWithId[] = [];
  const second: PanelWithId[] = [];
  let maxClipped = 0;

  for (const panel of panels) {
    const l = lo(panel, axis);
    const h = hi(panel, axis);
    if (h <= p) {
      first.push(panel);
    } else if (l >= p) {
      second.push(panel);
    } else {
      const portionLow = (p - l) / (h - l);
      const clipped = Math.min(portionLow, 1 - portionLow);
      if (clipped > maxClipped) maxClipped = clipped;
      if (portionLow > 0.5) first.push(panel);
      else second.push(panel);
    }
  }

  // Gutter measured between the two assigned groups; midpoint is the cut line.
  const maxHiFirst = first.length ? Math.max(...first.map((pp) => hi(pp, axis))) : p;
  const minLoSecond = second.length ? Math.min(...second.map((pp) => lo(pp, axis))) : p;
  return {
    first,
    second,
    maxClipped,
    gap: minLoSecond - maxHiFirst,
    at: (maxHiFirst + minLoSecond) / 2,
  };
}

/**
 * Best separating cut along `axis`, or null if none is valid.
 *
 * Tries a candidate at every panel's trailing edge (a line just past that box).
 * A cut counts only when it places at least one panel on each side and clips no
 * panel by more than `maxStraddleRatio` of that panel's own extent. Among the
 * valid cuts it returns the one with the smallest `maxClipped` (a perfectly
 * clean gutter, `maxClipped == 0`, always wins), breaking ties in favour of the
 * wider gutter and, failing that, the first candidate encountered (input order)
 * so the result is deterministic.
 */
function bestValidCut(panels: PanelWithId[], axis: Axis, maxStraddleRatio: number): Cut | null {
  let best: Cut | null = null;

  for (const candidate of panels) {
    const cut = evaluateCut(panels, axis, hi(candidate, axis));
    if (cut.first.length === 0 || cut.second.length === 0) continue;
    if (cut.maxClipped > maxStraddleRatio + EPS) continue;
    if (
      best === null ||
      cut.maxClipped < best.maxClipped - EPS ||
      (Math.abs(cut.maxClipped - best.maxClipped) <= EPS && cut.gap > best.gap + EPS)
    ) {
      best = cut;
    }
  }

  return best;
}

/**
 * Terminal for a region no cut can separate (true mutual overlap with no
 * dominant axis). Emits the panels in deterministic geometric order —
 * top-to-bottom, then right-to-left — via a binary horizontal split, so the
 * reading tree stays well-formed and the recursion terminates.
 */
function inseparable(
  panels: PanelWithId[],
  ro: ReadingOrderConfig,
  out: string[],
): ReadingTreeNode {
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
