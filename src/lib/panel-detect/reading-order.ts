import type { RawPanel, Panel } from './types';
import {
  type PanelDetectConfig,
  type ReadingOrderConfig,
  DEFAULT_PANEL_DETECT_CONFIG,
} from './config';

interface PanelWithId extends RawPanel {
  id: string;
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
 *      axes), fall back to tournament source selection over the pairwise
 *      reads-before relation (see {@link inseparable} / {@link isRow}): a
 *      slanted row stays together and reads right-to-left, while offset/tucked
 *      pairs read top-first.
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
 */
export function assignReadingOrder(
  rawPanels: RawPanel[],
  config: PanelDetectConfig = DEFAULT_PANEL_DETECT_CONFIG,
): Panel[] {
  const ro = config.readingOrder;
  if (rawPanels.length === 0) {
    return [];
  }

  const panels: PanelWithId[] = rawPanels.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
  }));

  const orderedIds: string[] = [];
  xyCut(panels, ro, orderedIds);

  const orderById = new Map(orderedIds.map((id, i) => [id, i + 1]));
  return panels
    .map((p) => ({ ...p, readingOrder: orderById.get(p.id)! }))
    .sort((a, b) => a.readingOrder - b.readingOrder);
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
 * order.
 */
function xyCut(panels: PanelWithId[], ro: ReadingOrderConfig, out: string[]): void {
  if (panels.length === 1) {
    out.push(panels[0].id);
    return;
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
    xyCut(h.first, ro, out);
    xyCut(h.second, ro, out);
    return;
  }

  // Otherwise the least-straddle vertical cut: RTL, right group first.
  if (v) {
    xyCut(v.second, ro, out);
    xyCut(v.first, ro, out);
    return;
  }

  // Genuinely inseparable region (mutual overlap, no dominant axis): order by
  // tournament source selection over the pairwise reads-before relation so the
  // recursion still terminates with a permutation-invariant order.
  inseparable(panels, ro, out);
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
 * wider gutter and, failing that, the geometrically earlier cut position
 * (smaller `at`) — never input order, so the choice is a function of geometry
 * alone.
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
      (Math.abs(cut.maxClipped - best.maxClipped) <= EPS &&
        (cut.gap > best.gap + EPS ||
          (Math.abs(cut.gap - best.gap) <= EPS && cut.at < best.at - EPS)))
    ) {
      best = cut;
    }
  }

  return best;
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

const cx = (p: RawPanel): number => p.x + p.width / 2;
const cy = (p: RawPanel): number => p.y + p.height / 2;

/**
 * Terminal for a region no axis-aligned cut can cleanly separate — e.g. a
 * full-width panel whose box overlaps the row below because of a slanted edge,
 * which clips a neighbour just past the straddle budget and defeats the cut
 * search on both axes.
 *
 * Every pair gets a reads-before direction from the rule that survives the
 * overlap which defeated the cut search:
 *   - a row pair (see {@link isRow}) reads right-to-left — the larger centre-X
 *     first;
 *   - otherwise the pair is stacked and reads top-first — the smaller centre-Y
 *     first, which also reads a diagonally offset pair top-left first.
 *
 * That relation is a tournament but NOT a total order — `isRow` is not
 * transitive (a tall panel can be "in a row with" each of several tiers that
 * are stacked relative to one another), so feeding it straight into
 * `Array.sort` hands the outcome to whichever comparisons the sort algorithm
 * happens to make, i.e. to input order. Instead we emit panels by repeated
 * source selection: take the panel that loses to no remaining panel. When the
 * tournament is acyclic that source is unique at every step, so the order is
 * the unique total order consistent with ALL pairwise comparisons —
 * permutation-invariant by construction. A cycle (rotational pinwheel) has no
 * source; then the fewest-losses panel wins, with geometric tie-breaks
 * (higher, then more right, then smaller) so the choice is still a function of
 * geometry alone.
 */
function inseparable(panels: PanelWithId[], ro: ReadingOrderConfig, out: string[]): void {
  const before = (a: PanelWithId, b: PanelWithId): boolean =>
    isRow(a, b, ro) ? cx(a) > cx(b) : cy(a) < cy(b);

  // Selection key: fewest losses first, then higher / more-right / smaller
  // geometry. If every component ties the boxes are identical and either
  // order yields the same geometric sequence.
  const key = (losses: number, p: PanelWithId): number[] => [
    losses,
    cy(p),
    -cx(p),
    p.height,
    p.width,
  ];
  const keyLess = (a: number[], b: number[]): boolean => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
  };

  const remaining = [...panels];
  while (remaining.length > 0) {
    let pick = remaining[0];
    let pickKey: number[] | null = null;
    for (const cand of remaining) {
      let losses = 0;
      for (const other of remaining) {
        if (other !== cand && before(other, cand)) losses++;
      }
      const candKey = key(losses, cand);
      if (pickKey === null || keyLess(candKey, pickKey)) {
        pick = cand;
        pickKey = candKey;
      }
    }
    out.push(pick.id);
    remaining.splice(remaining.indexOf(pick), 1);
  }
}
