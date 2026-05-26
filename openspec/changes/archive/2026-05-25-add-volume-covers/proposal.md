## Why

Volume tiles in the library currently render the first page of each volume file as a thumbnail, which is rarely the actual published cover art (frontmatter, blank pages, and copyright pages are common). Series detail pages already store a `mangadex_id` after the user runs "Fetch Metadata", but we don't use it to pull canonical cover art for either the series or its individual volumes. MangaDex exposes free, no-auth cover endpoints with per-volume granularity — we should use them.

## What Changes

- Add per-volume cover overrides stored at `MANGA_DIR/<Series>/.covers/vol-<filename>.cover.jpg`, taking priority over the existing page-1 thumbnail at `vol-<filename>.jpg` (which remains the fallback).
- Extract the existing `SeriesCardMenu` 3-dot overlay into a reusable `CoverMenu` component shared between series cards and volume tiles.
- Add a new menu option **"Auto-generate from web"** on both surfaces. For series it pulls the canonical MangaDex cover; for volumes it pulls the cover whose `volume` matches the volume number (preferring `en` locale, then `ja`, then any).
- The "Auto-generate from web" option is disabled (with explanatory tooltip) when the parent series has no `mangadex_id`.
- Add new API endpoints mirroring the existing series cover routes for volume covers, plus `cover/generate-web` endpoints on both series and volume scopes.
- After the user saves metadata in the Fetch Metadata modal, automatically fetch the series cover AND covers for every volume that does not already have a manual override file present.
- The volume thumbnail route (`GET /api/manga/[seriesId]/[volumeId]/thumbnail`) updates its lookup order to: external/manual cover → page-1 cache → generate page-1.

## Capabilities

### New Capabilities
- `cover-art`: Covers storage, resolution order, manual upload (file/URL), page-1 auto-generation, and MangaDex auto-fetch for both series and individual volumes. Includes the shared `CoverMenu` UI surface and all `cover` API endpoints.

### Modified Capabilities
- `manga-metadata-fetch`: Saving metadata now also triggers a bulk cover fetch (series + all volumes without manual overrides) using the new `cover-art` capability. The existing search/save behavior is unchanged.

## Impact

- **Code:**
  - New: `src/components/Library/CoverMenu.tsx` (extracted from `SeriesCardMenu.tsx`).
  - New: `src/lib/mangadex-covers.ts` (cover lookup/download helpers).
  - New API routes under `src/app/api/manga/[seriesId]/cover/generate-web/` and `src/app/api/manga/[seriesId]/[volumeId]/cover/` (POST file/URL, `generate`, `generate-web`).
  - Modified: `src/lib/pdf-utils.ts` adds `getVolumeCoverPath()` helper.
  - Modified: `src/app/api/manga/[seriesId]/[volumeId]/thumbnail/route.ts` checks the `.cover.jpg` override first.
  - Modified: `src/components/Library/VolumeThumbnail.tsx` (or `VolumeGrid.tsx`) wraps tile in admin-gated `CoverMenu`.
  - Modified: `src/components/Library/SeriesCard.tsx` swaps `SeriesCardMenu` for `CoverMenu` (with `target="series"`) and gains the new web option.
  - Modified: `src/app/library/[seriesId]/SeriesClientContent.tsx` triggers the bulk cover fetch after `handleConfirm` succeeds.
- **APIs:** No breaking changes — all new endpoints. The existing `GET .../thumbnail` response shape is unchanged; only the file it serves may differ.
- **Storage:** New file naming convention `vol-<filename>.cover.jpg` lives alongside existing `vol-<filename>.jpg` in `.covers/`. No migration needed — absent files mean the fallback chain kicks in.
- **External dependencies:** MangaDex API (`api.mangadex.org/cover` and `uploads.mangadex.org/covers/`). No auth, but rate limit (~5 req/sec global) requires a small inter-request delay during bulk fetch.
- **DB:** No schema changes. Existing `series.mangadex_id` and `volumes.volume_number` are sufficient.
