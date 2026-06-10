# Tasks

## 1. Remove the reading tree (no ordering change — D1, D5 step 1)

- [ ] 1.1 `reading-order.ts`: change `assignReadingOrder` to return `Panel[]` directly; delete the `OrderResult` interface; `xyCut` recurses for ordering only (append ids to `out`, return nothing); delete `chainTree`; `inseparable` just emits its sorted ids
- [ ] 1.2 `types.ts`: delete `ReadingTreeLeaf`, `ReadingTreeBranch`, `ReadingTreeNode`; remove `readingTree` from `DetectionResult`
- [ ] 1.3 `panel-data.ts`: remove the `readingTree` parameter from `insertPanelData` (write `NULL` to `reading_tree_json`); remove `readingTree` from `PanelDataPage`; `rowToPage` returns panels only
- [ ] 1.4 Update `assignReadingOrder` call sites to the new return shape: `job-manager.ts`, `src/app/api/panel-detect/route.ts`, `panel-data.ts` (`rowToPage`)
- [ ] 1.5 `src/app/admin/panel-jobs/page.tsx`: drop `readingTree` from `PreviewData` and the `DetectionCanvas` result literal
- [ ] 1.6 Tests: delete the tree property test (`the reading tree references exactly the returned panel ids`) and `collectTreePanelIds`; update any test destructuring `{ panels }` from the old shape; re-record golden snapshots (justification: tree removal — panel order must be byte-identical in the diff)
- [ ] 1.7 Verify: `npm test`, `npm run build`, `npm run lint` all green; labelled and real-page regression fixtures unchanged

## 2. Permutation-invariant ordering (D2, D3, D5 step 2)

- [ ] 2.1 `reading-order.ts`: replace `inseparable`'s pairwise sort with row clustering — union-find over `isRow` pairs, clusters ordered by ascending mean center-Y (tie: descending mean center-X), panels within a cluster by descending center-X (tie: ascending center-Y); update the function's doc comment to describe clustering
- [ ] 2.2 `reading-order.ts`: in `bestValidCut`, add a final geometric tie-break — when `maxClipped` and `gap` both tie within `EPS`, prefer the smaller `at`; update the doc comment ("first candidate encountered" no longer applies)
- [ ] 2.3 Add a labelled fixture: 3+ panel mixed row/stack inseparable region (a slanted row pair plus a stacked third panel, mutually overlapping so no valid cut exists) with a hand-verified RTL `expected` order
- [ ] 2.4 Re-record golden snapshots that change (justification: previously input-order-dependent outputs now canonical); confirm labelled and real-page regression fixtures still pass — if a real-page fixture flips, hand-verify the new order against the page image before updating it
- [ ] 2.5 Verify: `npm test` green

## 3. Permutation-invariance property test (D4)

- [ ] 3.1 In the structural-invariants suite, add a heavily-overlapping layout generator (large boxes biased to mutual overlap, seeded) alongside the existing one
- [ ] 3.2 Add the invariant test: for each layout from both generators, run `assignReadingOrder` on deterministic permutations (reverse, rotate-by-k, seeded shuffle) and assert the geometric reading sequence (key: `x,y,width,height`) is identical across permutations
- [ ] 3.3 Sanity check: temporarily revert task 2.1 locally to confirm the new test fails against the old comparator, then restore

## 4. Edge cleanups (D6)

- [ ] 4.1 `panel-data.ts`: extract a shared SELECT column list constant (`page_number, panels_json, page_type, processing_time_ms`) used by all three read queries; drop `reading_tree_json` from queries; narrow `PanelDataRow` to exactly the selected columns
- [ ] 4.2 `MangaReader.tsx`: replace the local `PanelDataPage` interface with a type-only import from `@/lib/panel-data` (keep the local `PanelDataResponse` envelope type)
- [ ] 4.3 Verify: `npm test`, `npm run build`, `npm run lint` all green

## 5. Documentation

- [ ] 5.1 Update `CLAUDE.md` panel-detection section: remove mentions of `reading_tree_json` / reading-tree snapshot semantics; note ordering is permutation-invariant and the inseparable fallback uses row clustering
