## 1. Lock the target with fixtures (red first)

- [x] 1.1 Add `tests/lib/panel-detect/fixtures/staggered-offset-rows.json` — a near-two-row RTL layout where one panel straddles the row boundary by less than `maxStraddleRatio`, with a hand-verified `expected` order and a `note`.
- [x] 1.2 Add `tests/lib/panel-detect/fixtures/diagonal-staircase.json` — panels descending top-right → bottom-left, each overlapping the next in both axes, with hand-verified RTL `expected` order and a `note`.
- [x] 1.3 Run `npm test -- reading-order` and confirm the two new labelled fixtures FAIL against the current algorithm (proving they capture the bug) while every existing labelled fixture still PASSES.

## 2. Config surface

- [x] 2.1 In `src/lib/panel-detect/config.ts`, replace `ReadingOrderConfig.gutterTolerance` with `maxStraddleRatio` (relative-to-box clip fraction, default `0.25`) and rewrite the JSDoc to describe the relative straddle / majority-snap semantics.
- [x] 2.2 Update `DEFAULT_PANEL_DETECT_CONFIG.readingOrder` to `{ maxStraddleRatio: 0.25 }`.
- [x] 2.3 Grep for `gutterTolerance` across the repo and update every reference (only `reading-order.ts` and config/tests are expected).

## 3. Scored-cut core in reading-order.ts

- [x] 3.1 Add a cut-evaluation helper that, given panels + axis + candidate position `p`, partitions panels by majority-snap (`portionLow > 0.5 ? first : second`) and returns `{ first, second, maxClipped, gap, at }`, where `maxClipped` is the largest per-panel clipped fraction and `gap` is the gutter width at `p`.
- [x] 3.2 Add `bestValidCut(panels, axis, maxStraddleRatio)`: evaluate a candidate at each panel boundary on the axis, keep only cuts with both sides non-empty and `maxClipped <= maxStraddleRatio`, and return the one with the smallest `maxClipped` (tie-break: wider `gap`); return `null` if none.
- [x] 3.3 Rewrite the `xyCut` selection to: try `bestValidCut(_, 'y')` first (horizontal → `top`/`bottom`, top recursed first), else `bestValidCut(_, 'x')` (vertical → RTL `right` recursed before `left`), preserving the existing `ReadingTreeNode` branch construction. This replaces both `cleanGutter` calls.
- [x] 3.4 Demote the center-of-mass fallback: remove the primary `fallbackCut` center-of-mass path; retain only the degenerate terminal for a genuinely-inseparable region (no valid cut on either axis) — emit panels in deterministic geometric order (`sort by y asc, then x desc`) via a binary `horizontal` cut node so the reading tree stays well-formed.
- [x] 3.5 Confirm RTL traversal is unchanged: vertical cuts recurse `right` before `left`, horizontal cuts recurse `top` before `bottom`; the flat `panels` order and the `readingTree` agree (same recursion produces both).

## 4. Validate behavior

- [x] 4.1 `npm test -- reading-order` — the two new fixtures (1.1, 1.2) now PASS.
- [x] 4.2 All pre-existing labelled fixtures (`classic-2x3-rtl`, `ambiguous-row-boundary`, `short-anchor-taller-neighbor`, `tall-left-stacked-right`, `three-column-tall-middle`, `full-width-strip-vs-side`, `single-panel`) still PASS unchanged.
- [x] 4.3 The 200-layout structural-invariant suite (length, permutation 1..N, tree-references-panels) stays green.
- [x] 4.4 Re-record the golden snapshot (`reading-order.test.ts.snap`); review the diff and confirm only the intended layouts changed before committing the new snapshot.

## 5. Verify the build

- [x] 5.1 `npm test` — full suite green.
- [x] 5.2 `npm run lint` — clean (no new problems; the 6 pre-existing errors are all in untouched `src/components/**` React files).
- [x] 5.3 `npm run build` — compiles.
- [x] 5.4 `npm run format:check` — clean (formatted the two changed source files; remaining warnings are pre-existing in untouched files).
