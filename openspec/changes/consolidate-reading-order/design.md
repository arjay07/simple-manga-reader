# Design

## Context

`assignReadingOrder` (`src/lib/panel-detect/reading-order.ts`) is a pure recursive XY-cut, recently rebuilt by the `scored-cut-panel-ordering` and `fix-reading-order-known-bugs` changes. It returns `{ panels, readingTree }`. Three findings motivate this change:

1. **The reading tree is dead downstream.** It is assembled in `xyCut`, fabricated by `chainTree` in the inseparable fallback (commented *"cosmetic; order is authoritative"*), written to `reading_tree_json`, recomputed by `rowToPage` on every read, and serialized into every `GET /api/panel-data/*` response — but no code reads it. `MangaReader.tsx` defines a local `PanelDataPage` without the field; `DetectionCanvas` only draws `result.panels`; `/admin/panel-jobs` passes `readingTree: null`. The prior design doc's hard constraint (*"rendered in /admin/panel-jobs"*) is stale — that visualization no longer exists.
2. **Ordering is not permutation-invariant.** An exploration probe over 500 random heavily-overlapping layouts found 37 whose reading order differs across permutations of the same input boxes (up to 3 distinct orders). Cause A: `inseparable()` sorts with `(a, b) => isRow(a, b) ? b.cx - a.cx : a.cy - b.cy` — `isRow` is a pairwise relation, not a total order, so the result depends on which comparisons TimSort performs. Cause B (minor): `bestValidCut` breaks exact score ties by input encounter order.
3. **Edge debt**: panel-data SELECTs fetch `reading_tree_json` that `rowToPage` ignores; `PanelDataRow` declares columns the queries don't select; `MangaReader.tsx` duplicates the `PanelDataPage` type.

Constraints: stored panel geometry remains the source of truth; order remains derived at read time; all labelled and real-page regression fixtures must stay green; the function stays pure, deterministic, and config-driven (`ReadingOrderConfig` unchanged).

## Goals / Non-Goals

**Goals:**
- Delete the reading tree from the algorithm, types, storage writes, and API payloads with no DB migration.
- Make reading order a pure function of panel geometry — identical output for every permutation of the input.
- Preserve exact ordering behaviour on every existing labelled and real-page fixture.
- Pin permutation invariance with a property test so it cannot regress.

**Non-Goals:**
- No DB migration (`reading_tree_json` stays as a nullable, unwritten legacy column).
- No change to detection, the XY-cut axis priority, the tall-right-column rule, `isRow`'s thresholds, or any `ReadingOrderConfig` value.
- No LTR support, no pinwheel/cluster handling — unchanged deferrals from the prior design.
- No attempt to make the *tree shape* canonical (the tree is being deleted).

## Decisions

### D1 — Delete the tree rather than keep it "for later"

`assignReadingOrder` returns `Panel[]` directly (the `OrderResult` wrapper and `ReadingTreeNode`/`Leaf`/`Branch` types are deleted). `xyCut` recurses purely for ordering (append ids to `out`), `chainTree` is deleted, and `insertPanelData` loses its `readingTree` parameter, writing `NULL` to the column.

*Why:* every consumer was checked — none reads the tree; it costs serialization on every read of every page, an API field, spec surface, and a property test. *Why not keep emitting it cheaply:* `chainTree` exists *only* to fabricate a tree for the fallback path, and the "tree references exactly the panel ids" invariant forces maintenance on every algorithm change. *Reversibility:* geometry is stored and order is derived at read time, so reintroducing tree assembly later reaches all existing volumes instantly — deleting now closes no doors. *Alternative rejected:* dropping the DB column too — a migration buys nothing; `INSERT OR REPLACE` with `NULL` naturally fades old values.

### D2 — Row clustering replaces the pairwise sort in `inseparable()`

Replace the non-transitive comparator with a three-step deterministic construction:

```
cluster:  union-find over all pairs (a, b) where isRow(a, b, ro)   // transitive closure
order clusters:   ascending mean center-Y of the cluster's panels
order within:     descending center-X (right-to-left)
```

`isRow` itself is unchanged — same two conditions, same `rowOverlapMinRatio` threshold. The change is only *how* the relation is consumed: as an equivalence-closure for grouping instead of as a sort comparator.

*Why:* this is the mental model the existing comments already describe ("panels that overlap in Y … are a row → right-to-left; otherwise stacked → higher first"), implemented in a way that is a total order by construction — permutation-invariant regardless of how panels arrive. *Behaviour preserved:* for 2-panel regions (all current verified fixtures) the result is identical — one cluster (row, RTL) or two clusters (stacked, top first) exactly matches the old comparator. Divergence is possible only for 3+ panel inseparable regions with mixed row/stack relations, where the old output was sort-order-dependent and therefore not meaningful to preserve. *Alternative rejected — full pairwise topological sort:* handles rotational pinwheels "correctly" but needs cycle-breaking (pinwheels are cyclic under any pairwise rule), and pinwheels remain unreported in the library; row clustering is strictly simpler and deterministic. *Tie within equal mean-Y or equal center-X:* fall through to the other coordinate (mean-X descending / center-Y ascending) so the construction stays total even for degenerate geometry.

### D3 — Geometric tie-break in `bestValidCut`

When two valid cuts tie on `maxClipped` (within `EPS`) and on `gap` (within `EPS`), prefer the cut with the smaller `at` (the earlier cut position on the axis) instead of "first candidate encountered".

*Why:* removes the last input-order dependence from the cut search. On clean grids two equal gutters tie; either choice yields the same final order (the recursion reads rows top-to-bottom regardless of which gutter splits first), so this cannot perturb fixtures — but it makes the choice, and with it the recursion shape, a function of geometry alone. *Alternative rejected — leaving it:* with the tree gone the shape is invisible, but the permutation-invariance property test (D4) would have to special-case "ties may differ", weakening the test; a geometric key costs one comparison.

### D4 — Permutation-invariance property test as the durable guard

Add to the structural-invariant suite (which loses its tree test): for each seeded random layout, run `assignReadingOrder` on several deterministic permutations (reverse, rotate, seeded shuffle — not factorial enumeration) of the input and assert the *geometric* reading sequence (panels keyed by `x/y/width/height`, not by assigned id) is identical. Include heavily-overlapping layouts like the probe's generator, since the default generator rarely hits the inseparable path.

*Why geometric keys:* ids are assigned by input index (`p${i+1}`), so they legitimately differ across permutations; geometry is the invariant. *Why a new labelled fixture too:* a 3+ panel mixed row/stack inseparable region gets a hand-verified expected order, pinning D2's *correctness*, while the property test pins its *stability*.

### D5 — Sequencing: tree removal first, then invariance fix

Implement and snapshot-re-record in two steps: (1) tree deletion — order unchanged, snapshots shrink to panels only; (2) D2+D3 — snapshots change only where input-order dependence existed. Each re-record has a single attributable cause, per the spec's "deliberate update with stated justification" rule.

### D6 — Edge cleanups ride along

`panel-data.ts`: one shared SELECT column list constant (`page_number, panels_json, page_type, processing_time_ms`), `PanelDataRow` narrowed to exactly those columns, `reading_tree_json` dropped from queries and the row type. `MangaReader.tsx` imports `PanelDataPage` (type-only) from `@/lib/panel-data` instead of redefining it; the local `PanelDataResponse` stays (it models the API envelope). The admin `PreviewData.readingTree` field and the `DetectionCanvas` `DetectionResult.readingTree` pass-through are deleted with the type.

## Risks / Trade-offs

- **[API shape change]** `readingTree` disappears from panel-data/panel-detect responses → the only consumer is this app's own UI, verified to never read the field; specs updated in the same change.
- **[D2 changes order on some real pages]** Any library page with a 3+ panel inseparable region may read differently → the old order there was input-order-dependent (effectively arbitrary); real-page regression fixtures are the canary — if one flips, the new order is hand-verified against the actual page before re-recording.
- **[Stale `reading_tree_json` values linger in existing rows]** → harmless: no code reads the column; rows fade to `NULL` on re-detection via `INSERT OR REPLACE`.
- **[Union-find adds code where a sort call sat]** → ~20 lines for a dozen-panel input; trivial n² pair scan is fine and far clearer than a comparator that lies about being a total order.
- **[Future feature wants the tree back]** → re-add tree assembly in `xyCut` behind the same recursion; derived-at-read-time means it instantly covers all stored volumes.

## Migration Plan

No data migration. Deploy is a normal release; old `reading_tree_json` values are ignored and overwritten with `NULL` as pages are re-detected. Rollback is a code revert — stored geometry is untouched by this change.

## Open Questions

- None blocking. If a real-page regression fixture flips under D2, the new order must be human-confirmed against the page image before the fixture is updated (per the existing test-pinning spec).
