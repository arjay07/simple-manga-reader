## Why

A geometry-diversity sweep over real library pages (Dragon Ball / Dragon Ball Super) plus human
confirmation surfaced two reading-order bugs the current recursive XY-cut gets wrong:

- **v157 p45** (slanted 3-tier fight): the first horizontal cut peels the top-right panel off alone,
  splitting the slanted top row, and then reads a mid-tier centre panel ahead of the rest. Correct
  RTL is `p1 p2 p4 p3 p6 p5`; the algorithm produces `p1 p3 p2 p4 p5 p6`.
- **v157 p176** (tall right-hand column): a tall full-height column on the right should read first,
  but the algorithm's "horizontal cut first, top group first" preference reads the top strip before
  it. Correct RTL is `p2 p1 p3 …`; the algorithm produces `p1 p2 p3 …`.

Both are already pinned as `it.fails` fixtures in `reading-order-regression.test.ts`. This change
implements the cut-heuristic improvements that make them read correctly **without regressing the 10
verified real-page fixtures**, then promotes the two fixtures to normal assertions.

## What Changes

- Modify the reading-order cut heuristics in `src/lib/panel-detect/reading-order.ts` so that:
  - a **slanted top row** (panels with overlapping vertical extents but a clear left/right split) is
    kept together and read right-to-left, rather than being split by a horizontal cut that isolates
    one panel; and
  - a **tall full-height right-hand column** beside a top strip + stacked rows is given reading
    precedence (read before the strip/rows to its left), consistent with RTL column-first reading.
- Promote the two `knownFailing` fixtures (`dbs-color v157 p45`, `dbs-color v157 p176`) to normal
  assertions once they pass.
- Update the golden reading-order snapshot if (and only if) the change alters output for a snapshot
  fixture, with the order preserved or the change justified.
- **No** schema, API, storage, or detection-model change. Because reading order is re-derived from
  geometry on every read, the fix applies to all already-detected volumes on next read.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `panel-detection`: the "RTL reading order via recursive spatial partitioning" requirement gains
  scenarios for a slanted top row and for tall-right-column precedence, and its stale "no clean cut"
  fallback scenario is corrected to the current horizontal-overlap rule.

## Impact

- **Code:** `src/lib/panel-detect/reading-order.ts` — the core cut-selection logic (`xyCut` /
  `bestValidCut`), and possibly the `inseparable` fallback. High blast radius; the regression suite
  is the guard.
- **Tests:** `tests/lib/panel-detect/reading-order-fixtures.ts` (promote 2 fixtures);
  `tests/lib/panel-detect/reading-order.test.ts` golden snapshot may update.
- **Runtime behaviour:** reading order changes for affected layouts across the whole library on next
  read; no migration.
- **Reference:** the diagnosis, cut trees, and landmines came from the oriented-panel-ordering
  spike investigation (local working notes, not committed).
