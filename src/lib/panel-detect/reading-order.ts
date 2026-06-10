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
 *   1. Tall right-hand column first: when a clean vertical cut isolates a
 *      single panel on the right spanning effectively the full height of the
 *      region (see {@link isTallRightColumn}), take it — RTL reads that column
 *      before the top strip and rows to its left, so it must beat the
 *      horizontal preference below.
 *   2. Otherwise prefer a HORIZONTAL cut (a full-width split). Manga reads row
 *      by row, so the group above the cut is read entirely before the group
 *      below.
 *   3. Otherwise take a VERTICAL cut (a full-height split). RTL: the group to
 *      the RIGHT of the cut is read entirely before the group to the left.
 *   4. If no valid cut exists on either axis (genuinely overlapping boxes —
 *      e.g. a slanted row whose diagonal divider makes the boxes overlap both
 *      axes), fall back to a per-pair rule keyed on vertical overlap (see
 *      {@link inseparable} / {@link isRow}): a slanted row stays together and
 *      reads right-to-left, while offset/tucked pairs read top-first.
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

  // Tall right-hand column exception: a clean vertical cut that isolates a
  // single, effectively full-height panel on the right wins over the row
  // split. RTL reads that column before the strip/rows to its left, so the
  // horizontal preference below must not peel a top strip off first.
  const v = bestValidCut(panels, 'x', ro.maxStraddleRatio);
  const columnFirst = v !== null && isTallRightColumn(v, panels, ro);

  // Prefer the least-straddle horizontal cut: manga reads row by row, top first.
  const h = columnFirst ? null : bestValidCut(panels, 'y', ro.maxStraddleRatio);
  if (h) {
    return {
      cut: 'horizontal',
      at: h.at,
      top: xyCut(h.first, ro, out),
      bottom: xyCut(h.second, ro, out),
    };
  }

  // Otherwise the least-straddle vertical cut: RTL, right group first.
  if (v) {
    return {
      cut: 'vertical',
      at: v.at,
      right: xyCut(v.second, ro, out),
      left: xyCut(v.first, ro, out),
    };
  }

  // Genuinely inseparable region (mutual overlap, no dominant axis): order by
  // the vertical-overlap row rule so the recursion still terminates.
  return inseparable(panels, ro, out);
}

/**
 * Does `cut` (a vertical cut) peel off a single right-hand panel that spans
 * effectively the full height of the region? Requires the cut to be clean
 * (zero straddle) so a column merely *near* a gutter cannot hijack a genuine
 * row layout — the verified row/banner pages all fail one of the three
 * conditions (multi-panel right group, straddled cut, or a short right panel).
 */
function isTallRightColumn(cut: Cut, panels: PanelWithId[], ro: ReadingOrderConfig): boolean {
  if (cut.maxClipped > EPS || cut.second.length !== 1) return false;
  const top = Math.min(...panels.map((p) => lo(p, 'y')));
  const bottom = Math.max(...panels.map((p) => hi(p, 'y')));
  return cut.second[0].height >= ro.tallColumnMinHeightRatio * (bottom - top);
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

interface Centroid {
  p: PanelWithId;
  cx: number;
  cy: number;
}

/**
 * Do two panels sit beside each other as a "row" (read right-to-left) rather
 * than "stacked" (read top first)? Two conditions, both required:
 *
 *   1. The shorter panel sees the other beside it for most of its height —
 *      their vertical overlap exceeds `rowOverlapMinRatio` of the shorter
 *      panel's height. A slanted row's boxes overlap in Y almost entirely even
 *      when a diagonal divider makes them overlap in X too, while a banner
 *      over the row beneath it (or a diagonally offset pair, which reads
 *      top-left first) overlaps only fractionally.
 *   2. The majority of the right panel's width extends beyond the left
 *      panel's right edge — the same majority-snap principle
 *      {@link evaluateCut} uses. When most of the right panel sits over the
 *      left one's X range it is tucked beside a dominant neighbour, and the
 *      pair reads top-first like a stack, not right-first like a row.
 */
function isRow(a: PanelWithId, b: PanelWithId, ro: ReadingOrderConfig): boolean {
  const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (yOverlap <= ro.rowOverlapMinRatio * Math.min(a.height, b.height)) return false;
  const right = a.x + a.width / 2 >= b.x + b.width / 2 ? a : b;
  const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return xOverlap < 0.5 * right.width;
}

/**
 * Terminal for a region no axis-aligned cut can cleanly separate — e.g. a
 * full-width panel whose box overlaps the row below because of a slanted edge,
 * which clips a neighbour just past the straddle budget and defeats the cut
 * search on both axes.
 *
 * Order the panels with a pairwise rule that keys on **vertical overlap**, the
 * signal that survives the overlap which defeated the cut search:
 *   - panels that overlap in Y for most of the shorter one's height are a row
 *     → right-to-left, the rightmost (larger centroid-X) first;
 *   - otherwise they are stacked → the higher one (smaller centroid-Y) reads
 *     first, which also reads a diagonally offset pair top-left first.
 *
 * Centroid-Y alone cannot distinguish a slanted row (small Y spread, must read
 * RTL) from a stacked pair (similar small Y spread, must read top-first); the
 * Y-overlap test does. An earlier X-overlap rule failed both ways on slanted
 * pages: a diagonal divider's X overlap marked a true row as stacked, and a
 * clean X split marked a diagonally offset stacked pair as a row.
 */
function inseparable(
  panels: PanelWithId[],
  ro: ReadingOrderConfig,
  out: string[],
): ReadingTreeNode {
  const items: Centroid[] = panels.map((p) => ({
    p,
    cx: p.x + p.width / 2,
    cy: p.y + p.height / 2,
  }));
  const sorted = [...items].sort((a, b) => (isRow(a.p, b.p, ro) ? b.cx - a.cx : a.cy - b.cy));
  for (const item of sorted) out.push(item.p.id);
  return chainTree(sorted, ro);
}

/** Right/down-leaning tree mirroring the comparator (cosmetic; order is authoritative). */
function chainTree(items: Centroid[], ro: ReadingOrderConfig): ReadingTreeNode {
  if (items.length === 1) return { panel: items[0].p.id };
  const [first, second, ...tail] = items;
  const rest = chainTree([second, ...tail], ro);
  if (isRow(first.p, second.p, ro)) {
    return {
      cut: 'vertical',
      at: (first.cx + second.cx) / 2,
      right: { panel: first.p.id },
      left: rest,
    };
  }
  return {
    cut: 'horizontal',
    at: (first.cy + second.cy) / 2,
    top: { panel: first.p.id },
    bottom: rest,
  };
}
