## Context

The project has 8 test files. They cluster precisely around code that has broken before — reading-order (fixture-based, 6× churn + a recent XY-cut fix), `extractVolumeNumber`, mangadex-covers, the thumbnail route. The team clearly knows how to test; the gap is that the next tier of branchy logic is **not reachable** by a cheap test because it is either (a) un-exported inside an IO-coupled module, or (b) buried in `MangaReader.tsx` (3,613 lines, churned 41× — the single biggest bug source in the repo).

Vitest (jsdom) is already configured with the `@` alias and a `tests/**` include. `better-sqlite3` (synchronous, supports `:memory:`) is already a dependency. `fetch` is already mocked in `mangadex-covers.test.ts`, and heavy module mocking is already demonstrated in `thumbnail-route.test.ts`. No new tooling is required.

## Goals / Non-Goals

**Goals:**
- Maximize regression protection per line of test by prioritizing pure, branchy logic.
- Make currently-untestable logic testable through behavior-preserving extraction/export, not rewrites.
- Establish a written boundary for what is intentionally left untested.

**Non-Goals:**
- No change to application behavior, API contracts, DB schema, or dependencies.
- No attempt to test `MangaReader.tsx` as a rendered component (canvas + pdfjs + gestures); only the pure logic extracted from it.
- No unit tests for third-party-guarantee code: thin `db-queries` SQL wrappers, `db.ts` schema/singleton, `constants`/`config`/`types`, Theme/Admin/Profile providers, `ml.ts`/`onnx-session`/`model-downloader` inference, `basePath`, and `page-source` dispatch. Testing these re-tests better-sqlite3, React, `onnxruntime`, or `sharp`.
- No coverage-percentage gate or CI threshold in this change.

## Decisions

### Decision: Sequence pure-and-cheap before harness-heavy
Do the zero-harness work first (classification, mangadex transforms, `parseJsonBody`, panel-data guards, the three extractions), then the harness-heavy queue-processor and manifest tests. **Why:** the first tranche delivers the largest coverage jump with near-zero flake risk and validates the approach before investing in mocks. *Alternative considered:* tackle the highest-value target (queue-processor) first — rejected because its mock harness is the most expensive and would stall early momentum.

### Decision: Extract pure logic rather than test through IO/UI
Three behavior-preserving moves:
- Panel-zoom geometry (lines ~35–90 of `MangaReader.tsx`) → `src/lib/reader/panel-zoom.ts`, called by the component.
- Volume-ordering comparator (the nulls-last `volumes.sort` in `queue-processor.create`) → an exported helper.
- Contour helpers (`findGutters`, `horizontal/verticalProjection`, `findPanels`, optionally `computeGutterConfidence`) → add `export`; the `detectPanelsContour` entry point that touches `sharp` stays untested.

**Why:** these functions are pure (dimensions/pixels in, values out) but unreachable today. Extraction makes them fixture-testable and doubles as decomposition work already planned in `decompose-manga-reader`. *Alternative considered:* test through the public IO surface (render the reader, run a real image through `detectPanelsContour`) — rejected as slow, flaky, and a weaker localization of failures.

### Decision: In-memory SQLite + mocked collaborators for the queue processor
Test `queue-processor.ts` lifecycle/crash-recovery against a real `better-sqlite3` `:memory:` DB seeded with the queue tables, with `jobManager` and `onnx-session` (`scheduleSessionRelease`/`cancelScheduledRelease`) mocked. Cover: `restoreFromDb` (running→pending, force paused), `cancel` (running→cancelled, pending→skipped), lifecycle guards throwing on wrong state, and `create` rejecting a second active queue. **Why:** the transitions are inline SQL, so a real in-memory DB exercises the actual statements while the mocks cut the ONNX/job dependency. These are the highest-cost-if-wrong invariants (a bad restart saturates CPU — the code comment says so). *Alternative considered:* refactor every transition into pure reducer functions first — rejected as a larger, riskier change than this proposal warrants; revisit only if the SQL harness proves unwieldy.

### Decision: Fixture-style tests where a table fits
Follow the existing reading-order fixture pattern for classification, panel-zoom geometry, and the comparator — `input → expected` rows. **Why:** consistency with the suite's strongest existing pattern; new fixtures can be appended whenever a future bug surfaces.

## Risks / Trade-offs

- **Extraction changes reader behavior** → Mitigation: move the geometry verbatim, keep the call site identical, and rely on `npm run build` plus a manual smoke of smart-panel-zoom; the spec includes a behavior-preserved scenario.
- **Exporting internals widens the module's API surface** → Mitigation: exported helpers are pure and self-contained; document them as test-facing. Low blast radius.
- **In-memory DB schema drifts from `db.ts`** → Mitigation: build the test schema from the same table definitions used at runtime (import/share rather than hand-copy) so a schema change can't leave the test green against a stale shape.
- **`MangaReader.tsx` may interleave the geometry with closure state** → Mitigation: if a clean pure boundary isn't available, scope this change to passing the already-pure portion and note the remainder as a target for `decompose-manga-reader` rather than forcing a risky cut.
- **Over-testing creep** → Mitigation: the non-goal list is itself a required deliverable, giving reviewers a basis to reject low-value tests.

## Migration Plan

Additive and reversible. New test files and one new `src/lib/reader/panel-zoom.ts`; source edits are imports plus added `export` keywords. Roll back by reverting the commit(s); no data or schema migration. Verify with `npm test` (all green) and `npm run build` (extractions compile).
