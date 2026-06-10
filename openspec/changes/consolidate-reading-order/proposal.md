# Consolidate Reading Order

## Why

The reading-order pipeline carries two kinds of dead weight. First, the `readingTree` structure is built, persisted (`reading_tree_json`), recomputed and serialized into every panel-data API response — yet nothing consumes it: the Reader's smart panel zoom uses only the flat ordered `panels` array, `DetectionCanvas` ignores the field, and the admin preview passes `readingTree: null`. Second, the reading order itself is not permutation-invariant: an empirical probe found 37 of 500 overlapping layouts whose reading order changes with the *input order* of the boxes (up to 3 distinct orders for identical geometry), because the inseparable-region fallback sorts with a non-transitive pairwise comparator and `bestValidCut` breaks exact ties by input position. Detection order — which can shift on re-detection — should never decide reading order.

## What Changes

- **Remove the reading tree end-to-end** — **BREAKING** (API response shape): delete `ReadingTreeNode`/`ReadingTreeLeaf`/`ReadingTreeBranch` types, tree assembly in `xyCut`, the cosmetic `chainTree` helper, the `readingTree` field from `assignReadingOrder`'s result, `DetectionResult`, `PanelDataPage`, and all panel-data/panel-detect API responses, and the `reading_tree_json` write in `insertPanelData`. The DB column remains (nullable, unwritten) — no migration. Stored geometry stays the source of truth, so a future tree feature can reintroduce assembly with zero data impact.
- **Make ordering permutation-invariant**: replace the inseparable fallback's non-transitive `Array.sort` comparator with tournament source selection — keep the existing pairwise reads-before rule (`isRow` → RTL, else top-first) but repeatedly emit the panel no remaining panel reads before, with a fewest-losses + geometric tie-break for cycles. Change `bestValidCut`'s final tie-break from "first candidate in input order" to a geometric key. Output reading order becomes a pure function of geometry alone.
- **Edge cleanups**: drop `reading_tree_json` from the panel-data SELECTs, align the `PanelDataRow` type with the columns actually selected, share the duplicated SELECT column list, and have `MangaReader.tsx` import the canonical `PanelDataPage` type instead of redefining it locally.
- **New durable test**: a structural-invariant property test asserting that every permutation of the input panels yields the identical geometric reading sequence.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `panel-detection`: Remove the "Reading tree output" requirement. The "Ordering is a separate stage" and "RTL reading order via recursive spatial partitioning" requirements drop the reading tree from their outputs; the inseparable-region scenario changes from a per-pair sort rule to tournament source selection over the pairwise reads-before relation; a new permutation-invariance scenario is added; the test-pinning requirement's structural invariants replace the tree invariant with the permutation invariant.
- `panel-data-storage`: `reading_tree_json` becomes a legacy unwritten column; API responses no longer include `readingTree`; the "Reading order is derived at read time" requirement covers order only, not the tree.

## Impact

- **Code**: `src/lib/panel-detect/reading-order.ts` (shrinks ~80 lines), `types.ts`, `panel-data.ts`, `job-manager.ts`, `src/app/api/panel-detect/route.ts`, `src/app/api/panel-data/*` (payload shape), `src/app/admin/panel-jobs/page.tsx`, `src/components/Reader/MangaReader.tsx` (type import only).
- **API**: `readingTree` field disappears from panel-data and panel-detect responses. The only client of these APIs is this app's own UI, which never reads the field — breaking on paper, inert in practice.
- **DB**: no migration; `reading_tree_json` stays nullable and stops being written.
- **Behavior**: reading order changes only on inseparable (mutually overlapping) regions with 3+ panels and on exact cut-score ties — clean grids, staggered rows, slanted rows, and tall-column layouts are pinned by existing fixtures and must not change.
- **Tests**: golden snapshots re-recorded (tree removal, then tie-break/fallback fix); labelled and real-page regression fixtures stay green; one new labelled fixture for a mixed row/stack inseparable region; new permutation-invariance property test.
