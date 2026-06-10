## Why

The recursive XY-cut in `assignReadingOrder` orders clean grids and blockage layouts (tall panel beside a stack) correctly, but **staggered/offset rows** and **diagonal/no-gutter** layouts misorder. Both fail the same way: when no gutter is perfectly clean, the algorithm drops into a center-of-mass fallback that confidently produces the wrong reading order. The root cause is the cut test itself — a gutter is accepted only if nothing straddles it by more than an *absolute* page fraction (`gutterTolerance: 0.03`), so a box that pokes a little across where the cut wants to go invalidates an otherwise-correct cut and forces the fragile fallback.

## What Changes

- **Replace the binary clean-gutter test with a scored cut.** Instead of "is this gutter clean? yes/no → else center-of-mass", every candidate cut line (both axes) is scored by how much it straddles panels, and the best-scoring *separating* cut is chosen. A perfectly clean gutter is simply the maximum score; a slightly-straddled cut still wins over no cut at all. This single mechanism subsumes both `cleanGutter` and `fallbackCut`.

- **Make the straddle test relative to each box, with majority-snap.** A cut may clip a panel by up to a fraction of *that panel's own* extent on the cut axis (`maxStraddleRatio`, default `0.25`), and a straddling panel is assigned to the side holding the majority of its area — rather than the current absolute `0.03 · page` tolerance that keeps a straddler on whichever side its leading edge sorted to. This is what rescues staggered rows and diagonal staircases: each panel sits *mostly* on one side of the least-bad cut, so it snaps correctly.

- **Remove the center-of-mass fallback.** The scored cut always yields a horizontal/vertical separation whenever any exists; a region only becomes a leaf when it is genuinely inseparable (a single panel, or one box that contains all the others). The degenerate positional split is retained only as the terminal guarantee that recursion terminates.

- **Reading-tree shape is unchanged.** Every split still emits a `horizontal`/`vertical` cut node with `at` and child branches; leaves still reference a panel `id`. No `reading_tree_json` schema change, no migration, no admin-viz change.

- **RTL only.** Direction handling is unchanged — right group first on vertical cuts, top group first on horizontal. No LTR support is added.

- **Validation.** Add labelled fixtures for staggered-offset-row and diagonal-staircase layouts with hand-verified RTL orders. All existing labelled fixtures stay green (they ride the clean-cut path and are unaffected); the golden snapshot is re-recorded (it flags *change*, not correctness).

- **Config.** `ReadingOrderConfig` replaces `gutterTolerance` with `maxStraddleRatio` (relative-to-box, default `0.25`); a small epsilon for treating a near-zero straddle as clean is internal. `DEFAULT_PANEL_DETECT_CONFIG` is updated accordingly.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities

- `panel-detection`: the *RTL reading order via recursive spatial partitioning* requirement changes its cut-selection and no-clean-cut behavior — staggered/offset rows and diagonal staircases are now ordered by a scored least-bad cut (relative-to-box straddle, majority-snap) instead of an absolute clean-gutter test plus center-of-mass fallback. New guaranteed scenarios for staggered rows and diagonal staircases; the *Reading tree output* requirement is unchanged.

## Impact

- **Code**
  - `src/lib/panel-detect/reading-order.ts` — rework `cleanGutter` + `fallbackCut` into a single scored-cut selector; keep the `xyCut` recursion, tree construction, and RTL traversal as-is.
  - `src/lib/panel-detect/config.ts` — `ReadingOrderConfig`: `gutterTolerance` → `maxStraddleRatio` (0.25); update `DEFAULT_PANEL_DETECT_CONFIG` and JSDoc.
  - Tests: new `tests/lib/panel-detect/fixtures/*.json` (staggered, diagonal staircase); re-record `reading-order.test.ts.snap`; structural-invariant and labelled-fixture suites stay green.
- **APIs / contracts**: none. `Panel[]` and `ReadingTreeNode` shapes are unchanged.
- **Storage**: none. No `panel_data` schema change, no migration.
- **Dependencies**: none added.
- **Relationship to `separate-panel-ordering-from-detection`**: independent. That change is storage plumbing and explicitly defers algorithm fixes; this is the algorithm fix. The plumbing's re-order action (when it lands) makes applying this to already-detected volumes cheap, but is not required — this change is developable and validated against the fixture baseline alone.
- **Risk**: low–medium. Pure, deterministic function; no I/O or schema surface. The behavioral surface is fully covered by the labelled fixtures (which pin correctness) and the golden snapshot (which pins change). The one accepted limitation: true rotational *pinwheel* layouts have no provably-correct order and receive a deterministic, sensible-but-not-guaranteed result; handling those is a future additive change (pairwise topological sort + a `cluster` tree node), explicitly out of scope here.
