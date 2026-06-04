## Why

The test suite (8 files) already covers exactly the logic that has historically broken — panel reading order, volume-filename parsing, MangaDex covers — but the highest-value pure logic is still untested because it is **trapped inside IO-coupled modules and a 3,600-line component**. A handful of cheap extractions plus table-style tests would lock down the branchy logic most likely to regress, without paying to test language or framework guarantees.

## What Changes

- **Add table-style tests for already-pure logic** that is currently untested: page-type classification (`classifyPageType` threshold boundary), MangaDex metadata transforms (author de-duplication, English-or-first selection), `parseJsonBody` malformed-input handling, and the `insertPanelData` validation guards.
- **Extract three pure functions out of IO/UI coupling, then test them:**
  - Panel-zoom geometry (single-stop vs multi-stop, stop count, zoom cap) out of `MangaReader.tsx` into `src/lib/reader/panel-zoom.ts`.
  - The volume-ordering comparator (sort by `volume_number`, nulls-last) out of `queue-processor.ts` into a shared helper.
  - The contour projection/gutter helpers (`findGutters`, `horizontal/verticalProjection`, `findPanels`) exported from `contour.ts` so they can be exercised over synthetic pixel buffers without `sharp`.
- **Add a crash-recovery/lifecycle test harness for `queue-processor.ts`** using an in-memory SQLite database with `jobManager` and the ONNX session mocked, covering the state-transition invariants (cancel skips remaining items, restart forces paused + resets `running`→`pending`, lifecycle guards throw on wrong state).
- **Add manifest-resilience tests for the GDrive download manager** (corrupt/missing manifest resolves to a sane default rather than throwing).
- **Record an explicit non-goal list** — modules that are intentionally NOT unit-tested because doing so would only re-test better-sqlite3, React, `onnxruntime`, or `sharp`.

No application behavior changes. The extractions are behavior-preserving refactors whose sole purpose is testability.

## Capabilities

### New Capabilities
- `automated-test-coverage`: Defines which behavioral guarantees of the codebase MUST be protected by automated regression tests, the convention that pure logic be extractable from IO/UI for testing, and the explicit set of modules excluded from unit testing because they only exercise third-party guarantees.

### Modified Capabilities
<!-- No spec-level behavior changes; extractions are behavior-preserving. -->

## Impact

- **New files:** `src/lib/reader/panel-zoom.ts` (extracted geometry), new test files under `tests/lib/`, `tests/lib/panel-detect/`, `tests/lib/reader/`, and `tests/lib/gdrive/`.
- **Modified source (refactor only):** `MangaReader.tsx` (import extracted geometry), `queue-processor.ts` (import extracted comparator), `contour.ts` and `mangadex.ts` (add `export` to currently-internal pure functions).
- **No changes** to API routes, DB schema, runtime behavior, or dependencies. Tooling stays on the existing Vitest/jsdom setup; in-memory SQLite uses the already-present `better-sqlite3`.
