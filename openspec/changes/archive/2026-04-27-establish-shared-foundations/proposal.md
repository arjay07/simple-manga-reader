## Why

The codebase has reached a size where small inconsistencies are starting to compound. An audit surfaced patterns that aren't dangerous individually but make every future change pay a tax:

- **Domain types are redefined per file.** `Profile` appears verbatim in 5 places (`src/app/page.tsx`, `src/components/Profile/ProfileForm.tsx`, `src/components/Profile/ProfileEditModal.tsx`, `src/components/ProfileProvider.tsx`, plus reader page). `Volume` (with the new `format` field) is redefined across 4+ route handlers. Adding a field means updating N copies.
- **Magic strings sprawl.** `localStorage` keys (`'theme'`, `'admin-mode'`, `'profileId'`, `'smartPanelZoom'`, `'focusMode'`, `'debugMode'`, `progress:{profileId}:{volumeId}`) live wherever they're first written. MIME types (`'application/pdf'`, `'application/vnd.comicbook+zip'`) and the `'pdf' | 'cbz'` union are inlined in 8+ files.
- **Three providers each implement their own localStorage sync.** `ThemeProvider`, `AdminProvider`, and `ProfileProvider` all repeat the same SSR-safe read/write/listener pattern.
- **Five components implement their own fetch+loading+error pattern** (`ContinueReading.tsx`, `VolumeProgress.tsx`, `page.tsx`, plus admin pages).
- **API routes repeat `try { ... } catch (e) { console.error(e); return NextResponse.json({ error }, 500) }` ~18 times.** A few `await request.json()` calls have no guard against malformed JSON.
- **No formatter, no tests.** Prettier is absent (ESLint handles linting only), and there is no test framework — so no unit tests exist for the pure-ish logic in `scanner.ts` or `reader-settings.ts`.

These foundations unblock the larger reader/panel-detect/admin refactors: every track downstream gets cleaner imports, fewer redefinitions, and a place to put new shared code.

## What Changes

- **Centralised domain types** — new `src/types/index.ts` (or `src/lib/types/`) exporting `Profile`, `Volume`, `Series`, `ProgressEntry`, `Format`. All call sites import from it; local redefinitions deleted.
- **Constants module** — new `src/lib/constants.ts` exporting `STORAGE_KEYS`, `MIME_TYPES`, and `FORMAT` (replacing the inline `'pdf' | 'cbz'` union where it appears).
- **Shared hooks** — new `src/hooks/` directory:
  - `useLocalStorage(key, initial)` — SSR-safe two-way sync; replaces the bespoke implementations inside the three providers.
  - `useFetch(url, deps)` — declarative fetch + loading + error; replaces the 5 hand-rolled `useEffect` patterns.
  - `useClickOutside(ref, callback)` — extracted from `HeaderMenu.tsx` lines 26–44 for reuse in modals.
- **API helpers** — new `src/lib/api-response.ts` exporting `apiError(message, status)`, `apiSuccess(data, status)`, and `parseJsonBody(request)` (returns `null` on parse failure rather than throwing). Replaces the `~18` repeated try/catch blocks across `src/app/api/`.
- **Shared db query module** — new `src/lib/db-queries.ts` for the 3+ duplicate `SELECT id, title, folder_name, ...` patterns identified in `src/app/api/manga/[seriesId]/route.ts` and `metadata/route.ts`.
- **Prettier config** — `.prettierrc.json` with the project's de-facto style (single quotes, no semicolons in tsx? — choose what matches existing code), plus `prettier` dev-dep and a `format` script. `npm run lint` continues to enforce ESLint; Prettier handles formatting.
- **Test framework starter** — vitest + jsdom + @testing-library/react as dev deps; `vitest.config.ts`; 2–3 tests:
  - `src/lib/scanner.ts` — `extractVolumeNumber()` against `Vol01.pdf`, `Vol01.cbz`, `#3.cbz`, `VOLUME 42.PDF`, edge cases.
  - `src/lib/reader-settings.ts` — `parseReaderSettings()` with null, malformed JSON, missing keys.
- **Adoption is incremental** — proposal lands the new modules and migrates the lowest-risk call sites; deeper migrations (e.g. swapping every provider's localStorage logic) happen as part of follow-up tracks or the natural touch of subsequent changes.

Out of scope: API auth/middleware (separate change if/when the app goes public), zod adoption (deferred — call out the gap, but adding a validation library is a track of its own), response-shape normalisation across all routes (would touch every consumer; phase later).

## Capabilities

### New Capabilities

- `shared-foundations`: Centralised domain types, constants, hooks, API helpers, formatter and test infrastructure that the rest of the codebase consumes.

### Modified Capabilities

None — this change introduces new modules and migrates a small set of call sites; behavioural surfaces are unchanged.

## Impact

- **Code**
  - New: `src/types/index.ts`, `src/lib/constants.ts`, `src/lib/api-response.ts`, `src/lib/db-queries.ts`, `src/hooks/useLocalStorage.ts`, `src/hooks/useFetch.ts`, `src/hooks/useClickOutside.ts`, `vitest.config.ts`, `.prettierrc.json`, `tests/` directory.
  - Touched: every file that currently redefines `Profile`/`Volume` (kept in sync via re-exports during transition if needed); a small set of API routes adopting `apiError`/`apiSuccess`.
- **Dependencies**
  - dev-deps: `prettier`, `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`.
- **APIs / contracts**
  - No external API shape changes. Internal type imports move from per-file definitions to `src/types`.
- **Operational**
  - `npm run format` (or equivalent) added.
  - `npm test` added; CI optional.
- **Risk**
  - Low. All changes are additive or substitutions of equivalent logic. Per-file type redefinitions are replaced one consumer at a time.
