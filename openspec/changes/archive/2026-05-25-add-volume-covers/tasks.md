## 1. Storage helpers and resolution chain

- [x] 1.1 Add `getVolumeCoverPath(folderName, volumeFilename)` helper in `src/lib/pdf-utils.ts` that returns `MANGA_DIR/<folder>/.covers/vol-<sanitized>.cover.jpg`, sharing the same sanitization logic as `getVolumeThumbnailPath`.
- [x] 1.2 Update `GET /api/manga/[seriesId]/[volumeId]/thumbnail/route.ts` to check the `.cover.jpg` override path FIRST; on hit, stream that file with `Content-Type: image/jpeg` and `Cache-Control: no-store` (so manual updates appear immediately).
- [x] 1.3 Verify the existing `vol-<filename>.jpg` page-1 fallback path still triggers when no override exists.

## 2. MangaDex cover lookup library

- [x] 2.1 Create `src/lib/mangadex-covers.ts` exporting `fetchSeriesCoverUrl(mangadexId)` and `fetchVolumeCoverUrl(mangadexId, volume)`.
- [x] 2.2 `fetchSeriesCoverUrl` calls `GET https://api.mangadex.org/cover?manga[]=<id>&order[volume]=asc&limit=1`, picks the first entry, and returns `https://uploads.mangadex.org/covers/<id>/<fileName>.512.jpg` or null.
- [x] 2.3 `fetchVolumeCoverUrl` calls `GET .../cover?manga[]=<id>&volume[]=<N>&limit=10` and selects an entry by locale priority `en > ja > any`, returning the `.512.jpg` URL or null.
- [x] 2.4 Both helpers use `AbortSignal.timeout(10_000)` and `User-Agent: simple-manga-reader/1.0` consistent with `src/lib/mangadex.ts`.
- [x] 2.5 Unit test the locale-selection logic in `tests/lib/mangadex-covers.test.ts` (jsdom + a fetch mock; no live network). Tests live under top-level `tests/` per the project's existing vitest config.

## 3. Server-side cover download helper

- [x] 3.1 Extract the URL-download logic currently inlined in `src/app/api/manga/[seriesId]/cover/route.ts` (scheme check, fetch, content-type validation, 10MB limit) into a shared helper `downloadImageToBuffer(url): Promise<Buffer>` in `src/lib/covers.ts` or a new `src/lib/cover-download.ts`.
- [x] 3.2 Refactor the existing series `cover` POST handler to use the helper. Existing behavior must be unchanged.
- [x] 3.3 Add a `saveVolumeCover(folderName, filename, buffer)` helper alongside `saveCover()` in `src/lib/covers.ts`.

## 4. New series-cover web endpoint

- [x] 4.1 Create `src/app/api/manga/[seriesId]/cover/generate-web/route.ts` exporting `POST`.
- [x] 4.2 Lookup series; return 404 if missing.
- [x] 4.3 Return 400 if `series.mangadex_id` is null with a message instructing the user to link via Fetch Metadata.
- [x] 4.4 Call `fetchSeriesCoverUrl`; on null return 502 with a "no cover available" message.
- [x] 4.5 Use `downloadImageToBuffer` then `saveCover` to overwrite `.covers/cover.jpg` and update `series.cover_path`.
- [x] 4.6 Return `{ success: true }` on success.

## 5. Volume cover endpoints

- [x] 5.1 Create `src/app/api/manga/[seriesId]/[volumeId]/cover/route.ts` with a `POST` handler that accepts either multipart `cover` file or JSON `{ url }`, mirroring the series endpoint but writing to the volume override path via `saveVolumeCover`.
- [x] 5.2 Reject when the volume does not exist or does not belong to the given series (404).
- [x] 5.3 Create `src/app/api/manga/[seriesId]/[volumeId]/cover/generate/route.ts` with a `POST` handler that re-extracts page 1 of the volume via `openPageSource`, encodes via `sharp`, and writes to `vol-<filename>.jpg` (the page-1 cache, NOT the override). Reuse the resize/quality settings from the existing thumbnail route.
- [x] 5.4 Create `src/app/api/manga/[seriesId]/[volumeId]/cover/generate-web/route.ts` with a `POST` handler:
  - Lookup volume + series; return 404 if either missing.
  - Return 400 if `series.mangadex_id` is null.
  - Return 400 if `volume.volume_number` is null.
  - Short-circuit success (no fetch) if the override file already exists — this enables idempotent bulk fetch.
  - Call `fetchVolumeCoverUrl`; return 404 if null (so client can show "no cover available").
  - `downloadImageToBuffer` + `saveVolumeCover` to write `vol-<filename>.cover.jpg`.

## 6. Reusable CoverMenu component

- [x] 6.1 Move `src/components/Library/SeriesCardMenu.tsx` to `src/components/Library/CoverMenu.tsx`. Keep the existing visual layout, modal scaffolding, and error/loading state.
- [x] 6.2 Generalize props to a discriminated union by `target`:
  ```ts
  | { target: 'series'; seriesId: number; mangadexId: string | null; onUpdated: () => void }
  | { target: 'volume'; seriesId: number; volumeId: number; mangadexId: string | null; onUpdated: () => void }
  ```
- [x] 6.3 Compute the relevant API URLs from `target`:
  - Series: `/api/manga/<seriesId>/cover`, `/cover/generate`, `/cover/generate-web`.
  - Volume: `/api/manga/<seriesId>/<volumeId>/cover`, `/cover/generate`, `/cover/generate-web`.
- [x] 6.4 Add a fourth menu item "Auto-generate from web" with a globe icon that POSTs to the appropriate `cover/generate-web` URL.
- [x] 6.5 Render the fourth item in a disabled state when `mangadexId` is null, with `title` attribute "Link this series to MangaDex via Fetch Metadata first."
- [x] 6.6 Show a transient error toast/banner when a `generate-web` call returns 404/502 (e.g. "No cover available on MangaDex for this volume").
- [x] 6.7 Update `src/components/Library/SeriesCard.tsx` to import `CoverMenu` with `target="series"` and pass `mangadexId={series.mangadex_id}`. Verify the SeriesListItem type carries `mangadex_id`; if not, add it via `getSeriesList()` query in `src/lib/db-queries.ts`.

## 7. Volume tile menu integration

- [x] 7.1 Wrap the `VolumeThumbnail` in `src/components/Library/VolumeGrid.tsx` (or directly inside `VolumeThumbnail.tsx`) with a `group relative` container that hosts the `CoverMenu`.
- [x] 7.2 Pass `target="volume"`, `seriesId`, `volumeId`, and `mangadexId` (read from the parent series — fetched on page load).
- [x] 7.3 Gate rendering on `useAdmin().isAdmin` so non-admins never see the menu.
- [x] 7.4 On `onUpdated`, force a thumbnail refresh by appending a cache-busting query param to the `<img src>` (e.g. `?v=${Date.now()}`) and re-rendering the tile.

## 8. Bulk fetch on metadata save

- [x] 8.1 In `src/app/library/[seriesId]/SeriesClientContent.tsx`, after `handleConfirm` successfully saves metadata AND the saved candidate has a `mangadexId`, kick off a bulk fetch.
- [x] 8.2 Sequentially `POST /api/manga/<seriesId>/cover/generate-web`, then for each volume `POST /api/manga/<seriesId>/<volumeId>/cover/generate-web`. The server-side override-skip handles the "preserve manual" case.
- [x] 8.3 Insert a 250ms `await` between volume requests to stay under MangaDex rate limits.
- [x] 8.4 Show a small inline progress indicator ("Fetching covers… 3/12") during the bulk run; do not block the modal close.
- [x] 8.5 On any per-volume failure, log to console and continue. Do NOT surface every failure as an error toast — only surface a summary if the entire batch fails.
- [x] 8.6 After the batch completes, call `router.refresh()` so the volume grid re-fetches with the new thumbnails.

## 9. Tests

- [x] 9.1 Unit test `getVolumeCoverPath` for both PDF and CBZ filenames in `tests/lib/pdf-utils.test.ts`.
- [x] 9.2 Integration test the resolution order in `tests/api/thumbnail-route.test.ts`: override present → override served, override absent + page-1 present → page-1 served, both absent + file present → page-1 generated.
- [x] 9.3 Test `mangadex-covers.ts` locale priority and the "no entries" path with mocked fetch responses. Covered alongside Task 2.5 in `tests/lib/mangadex-covers.test.ts`.
- [x] 9.4 Component test for `CoverMenu` covering: all four items render, disabled state when `mangadexId` is null, click handlers fire the correct URLs for each target. Lives at `tests/components/CoverMenu.test.tsx`.

## 10. Manual verification

- [x] 10.1 Run `npm run build` and `npm run lint`; both must pass. (Build: PASS. Lint: 19 problems exist in the codebase but ALL are pre-existing in unrelated files — `useGDriveProgress.ts`, `ProfileProvider.tsx`, `PageScrubBar.tsx`, `VerticalScrollView.tsx`, `MangaReader.tsx`. This change introduced 0 new lint issues.)
- [x] 10.2 Run `npm test` and confirm all new tests pass alongside the existing suite. (25/25 new cover-art tests pass. 1 pre-existing failure in `reader-settings.test.ts` is unrelated to this change.)
- [x] 10.3 Start the dev server with a series that has a `mangadex_id` and several volumes. Open the library, hover a volume tile, click "Auto-generate from web", confirm the cover updates in place.
- [x] 10.4 Repeat for a series WITHOUT `mangadex_id`: confirm the menu item is disabled with the tooltip.
- [x] 10.5 Run "Fetch Metadata" on an unmatched series, pick a candidate, save. Confirm the series cover updates and at least one volume cover updates within a few seconds. Confirm volumes that already had a manual override are untouched.
- [x] 10.6 Manually upload a cover for one volume via the menu. Run the bulk metadata flow again. Confirm the manual cover is preserved.
- [x] 10.7 Verify that with MangaDex blocked (e.g. via hosts file), the per-tile "Auto-generate from web" surfaces an error and the page-1 fallback continues to display.
