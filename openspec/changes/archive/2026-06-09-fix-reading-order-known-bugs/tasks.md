## 1. Reproduce and diagnose

- [x] 1.1 Run `npx vitest run tests/lib/panel-detect/reading-order-regression.test.ts` and confirm the two `knownFailing` fixtures (`dbs-color v157 p45`, `dbs-color v157 p176`) currently fail (expected-fail) and the other 10 pass
- [x] 1.2 Dump the `readingTree` for each known-failing fixture (throwaway temp test, not committed) and confirm the failure mechanism matches the investigation's fix brief (p45: top row split; p176: top strip read before the tall right column)

## 2. Fix Bug 1 — slanted top row kept together (v157 p45)

- [x] 2.1 Adjust cut selection so two panels overlapping in Y with a clean left/right split are read as a row (vertical RTL), not split by a horizontal cut that isolates one of them
- [x] 2.2 Verify `dbs-color v157 p45` now yields `p1 p2 p4 p3 p6 p5`
- [x] 2.3 Run the full regression suite — confirm the other 9 verified pages + ch68 are unchanged

## 3. Fix Bug 2 — tall right-hand column precedence (v157 p176)

- [x] 3.1 Give a full-height right-hand column reading precedence over the top strip + rows to its left (decide: pre-pass peel vs cut-preference change — pick the one that keeps the verified set green)
- [x] 3.2 Verify `dbs-color v157 p176` now yields `p2 p1 p3 p4 p5 p6 p7 p8 p9 p10 p11`
- [x] 3.3 Confirm the condition is scoped to full-height columns so it does not perturb banner/row layouts; run the full regression suite

## 4. Promote fixtures and finalize tests

- [x] 4.1 Remove `knownFailing: true` from both fixtures and let the regression test assert them normally; confirm `12 passed`
- [x] 4.2 Run `npx vitest run` (full suite); update the golden reading-order snapshot only if order is preserved (tree-only change) or the order change is justified
- [x] 4.3 Run `npm run lint` and `npm run format:check`; fix any issues in touched files

## 5. Document

- [x] 5.1 Update the top-of-file docstring in `reading-order.ts` to describe the slanted-row and tall-right-column handling
- [x] 5.2 Add a short note to this change's `design.md` explaining the cut-heuristic change and why it does not regress the verified set
