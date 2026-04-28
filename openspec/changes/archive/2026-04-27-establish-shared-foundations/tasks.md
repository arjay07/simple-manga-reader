# Tasks

## 1. Domain types module

- [x] 1.1 Create `src/types/index.ts` exporting `Profile`, `Volume`, `Series`, `ProgressEntry`, and re-exporting `Format` from `src/lib/page-source/types.ts`
- [x] 1.2 Replace local `Profile` redefinitions in `src/components/ProfileProvider.tsx`, `src/components/Profile/ProfileForm.tsx`, `src/components/Profile/ProfileEditModal.tsx`, `src/app/page.tsx`, and `src/app/read/[seriesId]/[volumeId]/page.tsx` with imports
- [x] 1.3 Replace local `Volume` redefinitions in route handlers under `src/app/api/manga/` and series detail components with imports
- [x] 1.4 Replace local `ProgressEntry` redefinitions in `src/components/Library/VolumeProgress.tsx` and `src/components/Library/ContinueReading.tsx` with imports
- [x] 1.5 `npm run lint` and `npm run build` clean

**Checkpoint A1**: Domain types consolidated. No behaviour change. Single PR.

## 2. Constants module

- [x] 2.1 Create `src/lib/constants.ts` exporting `STORAGE_KEYS` (theme, admin-mode, profileId, smartPanelZoom, focusMode, debugMode, progress prefix), `MIME_TYPES` (PDF, CBZ), and `FORMAT` (`'pdf' | 'cbz'` re-export from page-source/types)
- [x] 2.2 Replace inline localStorage keys in `ThemeProvider`, `AdminProvider`, `ProfileProvider`, and `MangaReader.tsx` with `STORAGE_KEYS.*`
- [x] 2.3 Replace inline MIME strings in `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts` and any other route returning PDF/CBZ bytes with `MIME_TYPES.*`
- [x] 2.4 `npm run lint` clean

**Checkpoint A2**: Magic strings centralised. Single PR.

## 3. Shared hooks

- [x] 3.1 Create `src/hooks/useLocalStorage.ts` — SSR-safe two-way sync, returns `[value, setValue]`. Test against existing provider behaviour
- [x] 3.2 Create `src/hooks/useFetch.ts` — accepts URL + deps, returns `{ data, loading, error, refetch }`; aborts on unmount via AbortController
- [x] 3.3 Create `src/hooks/useClickOutside.ts` — extract pattern from `src/components/HeaderMenu.tsx:26–44`
- [x] 3.4 Migrate `ThemeProvider` and `AdminProvider` to `useLocalStorage`. Defer `ProfileProvider` (it has the theme-override entanglement called out in audit; leave for the reader/profile track)
- [x] 3.5 Migrate `src/components/Library/ContinueReading.tsx` and `src/components/Library/VolumeProgress.tsx` to `useFetch`. Verify loading + error states still render the same UI
- [x] 3.6 Migrate `HeaderMenu.tsx` to use `useClickOutside`
- [x] 3.7 `npm run build` clean; manual smoke test of theme toggle, admin toggle, library load

**Checkpoint A3**: Three duplicate patterns collapsed into shared hooks. One PR or three small PRs (one per hook).

## 4. API helpers

- [x] 4.1 Create `src/lib/api-response.ts` exporting `apiError(message, status)`, `apiSuccess(data, status)`, and `parseJsonBody<T>(request)` returning `T | null`
- [x] 4.2 Migrate the lowest-risk routes to `apiError`/`apiSuccess`: `src/app/api/profiles/route.ts`, `src/app/api/profiles/[id]/route.ts`, `src/app/api/progress/route.ts`, `src/app/api/settings/route.ts`
- [x] 4.3 Add `parseJsonBody` guards to all POST/PUT routes that currently call `await request.json()` without a try/catch
- [x] 4.4 Leave panel-detect / panel-queue / gdrive routes for their respective tracks
- [x] 4.5 Verify each migrated endpoint with manual curl/browser request

**Checkpoint A4**: Boilerplate reduced in 4–6 routes; pattern established for the rest. Single PR.

## 5. Shared DB queries

- [x] 5.1 Create `src/lib/db-queries.ts` exporting `getSeries(id)`, `getSeriesList()`, `getVolume(id)`, `getProfile(id)` (and any other 2+ duplicate query identified during audit)
- [x] 5.2 Replace duplicate inline SQL in `src/app/api/manga/[seriesId]/route.ts` and `src/app/api/manga/[seriesId]/metadata/route.ts` with calls to the shared module
- [x] 5.3 Type the query results properly (each function returns the appropriate domain type from `src/types`)
- [x] 5.4 `npm run build` clean

**Checkpoint A5**: Schema is changed in one place, not three. Single PR.

## 6. Prettier

- [x] 6.1 Add `prettier` as a dev dependency
- [x] 6.2 Create `.prettierrc.json` matching the existing de-facto style — inspect a handful of files first to confirm semicolon and quote conventions
- [x] 6.3 Add `format` and `format:check` scripts to `package.json`
- [x] 6.4 Run `prettier --write` once across the repo; commit as a separate "style: prettier baseline" commit so blame stays meaningful
- [x] 6.5 Update `eslint.config.mjs` to disable rules that conflict with Prettier (or add `eslint-config-prettier`)

**Checkpoint A6**: Style automated. Single PR (or two — config + baseline format).

## 7. Vitest starter

- [x] 7.1 Add `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react` as dev deps
- [x] 7.2 Create `vitest.config.ts` with jsdom env and proper TypeScript paths
- [x] 7.3 Add `test` and `test:ui` scripts to `package.json`
- [x] 7.4 Write `tests/lib/scanner.test.ts` exercising `extractVolumeNumber()` for `Vol01.pdf`, `Vol01.cbz`, `#3.cbz`, `VOLUME 42.PDF`, no-number cases, empty string
- [x] 7.5 Write `tests/lib/reader-settings.test.ts` exercising `parseReaderSettings()` with `null`, malformed JSON, partial keys, all-keys
- [x] 7.6 Confirm `npm test` passes locally; document the command in CLAUDE.md "Commands" section

**Checkpoint A7**: Tests exist. Pattern established for future contributions. Single PR.

## 8. Verification

- [x] 8.1 Full `npm run lint` clean
- [x] 8.2 Full `npm run build` clean
- [x] 8.3 `npm test` passes
- [x] 8.4 Manual smoke: profile selector → library → series → reader (one PDF and one CBZ)
- [x] 8.5 Update `CLAUDE.md` "Commands" with `npm test` and `npm run format`; "Architecture / Key patterns" with the `src/types` and `src/hooks` locations

## 9. Cleanup

- [x] 9.1 Remove any now-dead local type definitions or duplicate patterns missed in §1–§5
- [x] 9.2 Confirm no `localStorage.getItem('...')` with hard-coded keys remains outside `STORAGE_KEYS`
- [x] 9.3 Confirm no `application/pdf` or `application/vnd.comicbook+zip` literals remain outside `MIME_TYPES`
