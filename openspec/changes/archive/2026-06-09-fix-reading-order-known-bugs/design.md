## Context

Reading order is computed by `assignReadingOrder` → recursive `xyCut` in
`src/lib/panel-detect/reading-order.ts`. At each region it picks the least-straddle horizontal cut
(rows, top first), else the least-straddle vertical cut (RTL, right first), else falls back to
`inseparable` (which now orders an overlapping cluster by a horizontal-overlap rule — a prior change,
`spike-oriented-panel-ordering`, replaced the old "geometric sort" fallback). Behaviour is pinned by
labelled fixtures + a golden snapshot, plus a real-page regression suite
(`reading-order-regression.test.ts`) with two `it.fails` fixtures for the bugs this change fixes.

Full diagnosis (cut trees, sweep results, scoring of alternatives) came from the
oriented-panel-ordering spike investigation (local working notes, not committed).

## Goals / Non-Goals

**Goals:**
- Make `dbs-color v157 p45` and `dbs-color v157 p176` read correctly (their confirmed RTL orders).
- Keep all 10 verified real-page fixtures and the existing labelled fixtures unchanged in order.
- Keep the change surgical and explainable; document why it does not regress the verified set.

**Non-Goals:**
- No panel-detection / segmentation change (the spike proved classical shape detection is infeasible
  on this content; detection-quality bugs are tracked separately).
- No new ordering algorithm wholesale-replacing XY-cut.
- No `maxStraddleRatio` global retune (proven not to be the lever).

## Decisions

### D1. Fix in the core cut logic, not by tuning a global threshold

The two failures are produced by *valid* cuts that don't match human reading, so the fix is about cut
*selection/preference*, not the straddle budget. An empirical `maxStraddleRatio` sweep (0.25→0.5)
showed every value trades one page for another — it is not the lever. Alternatives scored worse than
XY-cut on the fixtures (XY-cut 9–10/12, gap-geometry 5/12, centroid-band 4/12), so XY-cut stays the
base and is improved surgically.

- **Bug 1 (v157 p45):** the top tier is a slanted two-panel row (p1 top-right, p2 top-left-wide) with
  identical/overlapping vertical extents; a horizontal cut isolates p1 and breaks the row. The fix
  must recognise that two panels overlapping in Y with a clean left/right split are a *row* (vertical
  RTL), not a horizontal split — i.e. prefer the vertical row-split when a horizontal cut would only
  separate part of an overlapping row.
- **Bug 2 (v157 p176):** a tall full-height right-hand column (p2) should read before the top strip
  (p1) and the rows to its left. The current "horizontal cut first" preference reads the strip first.
  The fix must let a tall rightmost column take precedence — e.g. detect a full-height right-side
  column and emit it before recursing the left block.

### D2. The regression suite is the arbiter, and it is broad

The 10 verified fixtures span grids, banners, tall columns, and side-by-side rows. Any heuristic
change is accepted only if it turns the two known bugs green AND leaves all 10 untouched. This is
what protects against a "fix one, break others" outcome that the threshold sweep demonstrated.

### D3. Promote fixtures and update the snapshot deliberately

When a bug passes, its `it.fails` errors; convert it to a normal `it` and remove `knownFailing` from
the fixture. If the golden snapshot changes, confirm the reading *order* is preserved for that
fixture (only the non-authoritative tree may differ) or justify the order change.

## Risks / Trade-offs

- **High blast radius (core cut logic).** → Guarded by the broad regression suite + labelled fixtures
  + golden snapshot + structural-invariant property tests; run the full suite, not just the two.
- **Bug 2 is a convention conflict** (row-first vs rightmost-column-first). → Resolve with a rule that
  is conditioned on a *full-height* right column so it does not hijack ordinary banner/row layouts in
  the verified set.
- **Over-fitting to two pages.** → Prefer the most general rule that passes; if a general rule risks
  the verified set, a narrower, well-justified condition is acceptable since the suite bounds it.

## Migration Plan

None. Reading order is re-derived from stored geometry on every read, so the fix applies to all
volumes on next read with no data migration or re-detection.

## Open Questions

- Bug 2: is "full-height right-hand column reads first" best expressed as a pre-pass (peel the column)
  or as a change to the horizontal-vs-vertical cut preference? Decide by which keeps the verified set
  green with the simplest rule.

## Implementation Notes (post-fix)

**Bug 1 landed in the `inseparable` fallback, not `bestValidCut`.** Dumping the reading tree showed
the fix brief's "horizontal cut @0.399 isolating p1" was actually the cosmetic `chainTree` of the
fallback: p45 has *no* valid cut anywhere (p1/p2 share identical Y extents and every candidate clips
a panel past the 0.25 budget), so the whole page is one inseparable cluster and the pairwise rule is
the only lever. The old rule keyed on X overlap and failed both ways on this page: the diagonal
divider's X overlap marked the true bottom row (p5/p6) as stacked, and the clean X split marked the
diagonally offset middle pair (p4 above-left of p3) as a row.

The new `isRow(a, b)` requires BOTH: (1) vertical overlap > `rowOverlapMinRatio` (0.75) of the
shorter panel's height — slanted-row boxes overlap in Y almost entirely (≥0.99 across all confirmed
row pairs) while confirmed stacked/offset pairs overlap ≤0.60; and (2) the majority of the right
panel's width extends past the left panel's right edge (X overlap < 0.5 × right width — the same
majority-snap constant `evaluateCut` uses). Condition (2) is what separates the two near-identical
heavy-overlap pairs in the corpus: 022.png's top pair (right panel 55% tucked over the left one →
reads left/top first, confirmed) vs p45's bottom pair (43% → genuine slanted row, reads RTL). Every
must-pair across the six inseparable clusters in the fixture corpus (p45 whole page, ch68 middle
block, 037 middle block, 019.png's 7-panel cluster, 022.png's top pair, the full-width-strip labelled
fixture) was checked against the combined rule; the verified clusters produce byte-identical orders.

**Bug 2 landed as a cut-preference exception, not a peel pre-pass.** `xyCut` now computes the best
vertical cut first and takes it ahead of the horizontal preference only when `isTallRightColumn`
holds: the cut is clean (zero straddle), its right group is a single panel, and that panel spans
≥ `tallColumnMinHeightRatio` (0.75) of the region's height (p176's column spans 0.81; the tallest
verified non-column right panel in a horizontal-cut region spans ≤0.55). In the verified set this
condition only holds in regions where no valid horizontal cut exists — i.e. where the same vertical
cut was already taken — so trees and orders there are unchanged; 022.png's superficially similar
"tall right panel beside a left stack" region is excluded because its bottom strip straddles the
would-be vertical cut (not clean), which is exactly why its column correctly reads *after* the left
stack's top panel.

The golden snapshot did not change (the labelled-fixture cut trees are identical), confirming both
rules are scoped to the two bug layouts.
