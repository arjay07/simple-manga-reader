# Design

## Context

`assignReadingOrder` (`src/lib/panel-detect/reading-order.ts`) is a pure recursive XY-cut. `xyCut` recurses, and at each level:

1. `cleanGutter('y')` — take a full-span horizontal gutter if one exists (rows first, top group before bottom).
2. else `cleanGutter('x')` — take a full-span vertical gutter (RTL, right group before left).
3. else `fallbackCut` — split at the largest **center-of-mass** gap on the more-separated axis.

`cleanGutter` accepts a gutter only if no panel straddles the cut line by more than `gutterTolerance = 0.03` of the normalized page extent — an **absolute** test. A straddling panel keeps whichever side its *leading edge* sorted to.

This orders clean grids and blockage layouts correctly (proven by the `classic-2x3-rtl`, `tall-left-stacked-right`, `three-column-tall-middle` fixtures). It misorders **staggered/offset rows** and **diagonal/no-gutter** layouts, because a panel poking a little across the row boundary exceeds the absolute tolerance, no clean gutter is found, and step 3's center-of-mass split produces a confident-but-wrong order.

**Hard constraint:** the `readingTree` produced by the recursion is persisted as `reading_tree_json` (`db.ts`, `panel-data.ts`) and rendered in `/admin/panel-jobs`. Any redesign must keep emitting the existing `ReadingTreeNode` shape — `{ cut, at, top/bottom | left/right }` branches and `{ panel }` leaves — with no new node kind, so there is zero storage/migration/viz impact.

## Goals / Non-Goals

**Goals:**
- Correctly order staggered/offset rows and diagonal staircase layouts in RTL.
- Replace the absolute clean-gutter test + center-of-mass fallback with one scored cut driven by a relative-to-box straddle measure and majority-side assignment.
- Preserve exact behavior on all existing labelled fixtures (clean grids, blockage).
- Keep the `ReadingTreeNode` shape unchanged.
- Keep the function pure, deterministic, and config-driven.

**Non-Goals:**
- LTR support (RTL only; the traversal keeps right-before-left on vertical cuts).
- Pairwise topological sort and a `cluster` tree node for true rotational **pinwheels** — deferred to a future additive change.
- Inset/containment clustering and splash special-casing — out of scope (ML detection already suppresses containment; the user's broken layouts don't involve these).
- Any change to detection, storage, or the admin UI.

## Decisions

### D1 — Relative-to-box straddle with majority-snap (vs. absolute tolerance)

A cut at position `p` on an axis classifies each panel by its interval `[lo, hi]` on that axis:

```
if hi <= p           -> side LOW   (fully before the cut)
elif lo >= p         -> side HIGH  (fully after the cut)
else                                 // straddles
   portionLow = (p - lo) / (hi - lo)
   clipped    = min(portionLow, 1 - portionLow)     // fraction of the box the cut shaves off
   side       = portionLow > 0.5 ? LOW : HIGH        // majority-snap
```

A cut is **valid** iff both sides are non-empty and `max(clipped) <= maxStraddleRatio` (default `0.25`). The straddle is measured against **each box's own extent**, so a small clip of a large panel no longer kills a cut, and a straddling panel is placed on the side holding the majority of its area — not on whichever side its leading edge happened to sort to.

*Why:* this is the Kovanen/Manga109 interception test (validated to >95% transition accuracy on 1,769 manga pages). It is what rescues staggered rows: the row boundary is no longer required to be a perfectly empty line. *Alternative rejected:* simply raising the absolute `gutterTolerance` — a larger absolute slack risks slicing a genuinely small panel in half while still failing for large offset panels; the relative test scales correctly with panel size.

### D2 — Scored selection *within* horizontal-first axis priority (vs. global min-straddle)

Axis priority is preserved: **prefer a valid horizontal cut whenever one exists**, fall to vertical only when no horizontal cut is valid. The "scored" part operates *within* the chosen axis — among all valid candidate cuts (one per panel boundary), pick the one with the **smallest `max(clipped)`**, breaking ties by the **wider gutter**.

```
chooseCut(panels):
  h = bestValidCut(panels, axis='y')      // least-straddle horizontal, or null
  if h: return horizontal(h)
  v = bestValidCut(panels, axis='x')      // least-straddle vertical, or null
  if v: return vertical(v)                 // RTL: right child first
  return inseparable(panels)               // D3
```

*Why not* a single global score that picks the least-straddle cut across **both** axes? Because a 2×3 grid with a slightly noisy row boundary (horizontal straddle ≈0.05) but a perfectly clean column gutter (straddle 0) would then be cut **column-first**, reading the whole right column top-to-bottom instead of row-by-row — wrong for manga. Horizontal-first keeps rows-before-columns, exactly as today; the relative test only changes *whether* a horizontal cut is considered valid, never demoting it below a cleaner vertical one. Verified against the blockage cases: a full-height tall panel makes every horizontal cut exceed `maxStraddleRatio`, so the algorithm correctly falls to the vertical cut — unchanged from today.

This unifies `cleanGutter` and the primary fallback: a perfectly clean gutter is just the `clipped == 0` case of the same scorer.

### D3 — Demote center-of-mass to the inseparable terminal (preserve tree shape)

When no valid cut exists on either axis (a genuinely inseparable region — true mutual overlap with no dominant axis), emit the panels in deterministic geometric order — **top-to-bottom, then right-to-left** (`sort by y asc, then x desc`) — via the existing degenerate binary split that produces a real `ReadingTreeNode` branch. Center-of-mass is thus **demoted** from "the fallback whenever no clean gutter" (frequent, fragile) to "the terminal for the rare truly-inseparable region" (and even there, the geometric top-to-bottom order is correct for the common diagonal staircase).

*Why:* keeps the `ReadingTreeNode` shape binary and well-formed with no new node kind → no `reading_tree_json` / admin-viz change. *Alternative deferred:* a pairwise topological sort with a new `cluster` leaf node — strictly better only on rotational pinwheels, which the user has not reported, and which carry storage + viz cost. This change is the foundation that such an escalation would build on, so deferring closes no doors.

### D4 — `ReadingOrderConfig`: `maxStraddleRatio` replaces `gutterTolerance`

`gutterTolerance` (absolute, `0.03`) is removed and replaced by `maxStraddleRatio` (relative, `0.25`) in `ReadingOrderConfig`, with updated JSDoc. `DEFAULT_PANEL_DETECT_CONFIG` is updated. This is an internal config object (consumed by `assignReadingOrder` with a default); no persisted config references it.

### D5 — Validation: labelled fixtures pin correctness, snapshot pins change

Add labelled fixtures with hand-verified RTL `expected` orders: a staggered/offset-row layout (a panel straddling the row boundary by < `maxStraddleRatio`), and a diagonal staircase (consecutive panels overlapping in both axes, descending top-right → bottom-left). The existing labelled fixtures MUST stay green unchanged. The golden snapshot (`reading-order.test.ts.snap`) is re-recorded — it asserts *stability*, not correctness, so a deliberate re-record is expected. The 200-layout structural-invariant suite (permutation, tree-references-panels) MUST stay green.

## Risks / Trade-offs

- **A clean grid changes reading order** → Mitigated by D2 (horizontal-first preserved) and the labelled fixtures, which pin the exact RTL order for grid and blockage cases and must stay green. The snapshot diff is reviewed before re-recording to confirm only intended layouts changed.
- **`maxStraddleRatio` mis-tuned** (too high slices real panels; too low reverts to fragile behavior) → `0.25` is the literature-validated default; it is exposed in `ReadingOrderConfig` for A/B tuning without code change, consistent with the existing config surface.
- **True pinwheel layouts get a deterministic but not provably-correct order** → Accepted and documented (Non-Goals). No regression vs. today (which also has no principled answer). Escalation path (topological sort + `cluster` node) is additive and left for a future change.
- **Inseparable-terminal emits a `cut` node that isn't a real gutter** → Pre-existing behavior of the current `fallbackCut`; not a regression, and reached far less often than today.

## Migration Plan

None. Pure function change with no schema, API, or dependency impact. Rollback is reverting the commit. Existing stored `panels_json` / `reading_tree_json` are not rewritten by this change; re-ordering already-detected volumes onto the new algorithm is the job of the separate `separate-panel-ordering-from-detection` re-order action (or a one-off re-detect), and is out of scope here.

## Open Questions

- Should the staggered fixture also assert the resulting `readingTree` (not just the flat order)? Leaning yes via the golden snapshot, which already captures the tree for every fixture.
