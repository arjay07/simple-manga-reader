## Context

The library has two existing cover surfaces:

- **Series cover** — manual upload / URL paste / "Auto-generate" (page 1 of vol 1). Stored at `MANGA_DIR/<Series>/.covers/cover.jpg` and referenced via `series.cover_path`. The `SeriesCardMenu` 3-dot overlay drives all three actions.
- **Volume thumbnail** — always auto-generated from page 1 of the volume file, cached at `MANGA_DIR/<Series>/.covers/vol-<filename>.jpg`. No user override exists today; the page-1 image is what you get.

The codebase already has a working MangaDex integration (`src/lib/mangadex.ts`) used by the "Fetch Metadata" flow, which writes `series.mangadex_id` after the user confirms a match. That ID is the perfect handle for a per-volume cover lookup, but is currently unused after metadata save.

This design adds a new layer of "external/manual cover override" — a sibling file `vol-<filename>.cover.jpg` that the thumbnail route prefers when present — and reuses the existing menu pattern across both surfaces, with a new "Auto-generate from web" option backed by MangaDex.

## Goals / Non-Goals

**Goals:**
- Per-volume cover overrides storable via the same three input methods that series covers already support (file, URL, page-1), plus a new fourth method (MangaDex).
- A single `CoverMenu` component shared by series cards and volume tiles to avoid divergent menus.
- Auto-population of all covers (series + volumes) on metadata save, since the user has just provided an authoritative `mangadex_id`.
- Graceful fallback: if MangaDex is unreachable, has no match for a given volume, or the series has no `mangadex_id`, the user sees today's behavior — never a broken tile.
- Manual overrides (file/URL) must always survive bulk re-fetches.

**Non-Goals:**
- Cover variants per locale beyond a hard-coded preference order. We pick one image and store one file.
- A cover gallery / browser to choose among multiple MangaDex covers per volume. Out of scope; future work.
- Auto-linking series to MangaDex without user confirmation. The `mangadex_id` only gets set through the existing Fetch Metadata flow.
- Background fill on library load (offered during exploration but not selected). Refresh is explicit: either via metadata save or via the per-tile menu.
- Migrating existing `vol-X.jpg` page-1 thumbnails to `vol-X.cover.jpg`. The two are different conceptually; we just add a new file alongside.
- A bulk "refetch all volume covers" button on the series page (offered but not selected — the per-tile menu is the unit of control, with auto-fetch on metadata save handling the bulk case).

## Decisions

### File-based override at `vol-<filename>.cover.jpg`

Pros: Zero schema change. Resolution order is a one-line `fs.existsSync` check in the thumbnail route. Manual overrides survive `Refetch Metadata` automatically because we just check for the file's presence before bulk-fetching.

Alternatives considered:
- **DB column `volumes.cover_source` + `cover_path`**: more explicit, but adds migration surface and we'd need to keep the file system and DB in sync. Pure filesystem is simpler and matches how `series.cover_path` already works.
- **Replace `vol-X.jpg` directly when a cover is set**: loses the page-1 fallback when MangaDex later removes the cover, and conflates "what page 1 looks like" with "what the cover is."

### Capability boundary: new `cover-art`, modified `manga-metadata-fetch`

The existing `manga-metadata-fetch` capability covers the search/save flow. Cover handling is a distinct concern (storage, multiple sources, two scopes) and pre-existed in the codebase without a spec. Carving out a `cover-art` capability captures the existing series-cover behavior plus the new volume-cover behavior in one place. The `manga-metadata-fetch` spec gets a small modification: saving metadata triggers a bulk cover fetch.

### Reuse `SeriesCardMenu` pattern via parameterized `CoverMenu`

The existing menu has all the modal/loading/error scaffolding we need. Generalizing it to accept a `target` (series or volume IDs) and a `coverArtSupported` flag (whether to show "Auto-generate from web") is cheaper than building a parallel component, and keeps the two surfaces visually identical.

The component takes:
```ts
type CoverMenuProps =
  | { target: 'series'; seriesId: number; mangadexId: string | null; onUpdated: () => void }
  | { target: 'volume'; seriesId: number; volumeId: number; mangadexId: string | null; onUpdated: () => void };
```

The `mangadexId` (always referring to the parent series) controls whether the "Auto-generate from web" item is enabled.

### MangaDex cover lookup

Two helper functions in `src/lib/mangadex-covers.ts`:

```ts
fetchSeriesCoverUrl(mangadexId: string): Promise<string | null>
// GET /cover?manga[]=<id>&order[volume]=asc&limit=1&includes[]=cover_art
// Returns uploads.mangadex.org/covers/<id>/<fileName>.512.jpg or null

fetchVolumeCoverUrl(mangadexId: string, volume: number): Promise<string | null>
// GET /cover?manga[]=<id>&volume[]=<N>&limit=10
// Picks locale=en > ja > any. Returns the .512.jpg URL or null.
```

Both use a 10-second `AbortSignal.timeout` consistent with the existing `searchManga` helper, and a `User-Agent: simple-manga-reader/1.0` header.

The `.512.jpg` size variant matches the volume tile's render width (~600px) without being wasteful. Original-size covers are typically 1500px+ and would inflate storage 5–10x for no visible gain.

### Image download path: client → app server → MangaDex

The cover-from-URL endpoint already exists for series and downloads the URL server-side, returning success/failure. We extend the same pattern to volumes and to the new `generate-web` endpoints. The browser never talks to `uploads.mangadex.org` directly — keeps CORS simple, lets us validate content-type/size, and matches the existing `MAX_URL_DOWNLOAD_SIZE` (10MB) safeguard.

### Bulk fetch on metadata save

After `POST /api/manga/[seriesId]/metadata` succeeds, the client sequentially fires:
1. `POST /api/manga/[seriesId]/cover/generate-web` (overwrite series cover)
2. For each volume in the series where `vol-<filename>.cover.jpg` does NOT exist:
   `POST /api/manga/[seriesId]/[volumeId]/cover/generate-web`

The skip-if-exists check happens server-side per request (the route checks the override file before fetching). This way the client doesn't need to know which files are present — it can fire requests for every volume and the server short-circuits the ones with overrides.

A 250ms inter-request delay on the server side (or batching N=4 in parallel) keeps us under MangaDex's ~5 req/sec global limit.

### "Auto-generate from web" is disabled, not hidden, when unmatched

Hiding the option entirely makes the menu inconsistent across series. Disabling it with a tooltip ("Link this series to MangaDex via Fetch Metadata first") teaches the user how to enable it. This matches the broader project pattern of explicit user actions over magic.

## Risks / Trade-offs

- **MangaDex rate limits** → Bulk-fetch path adds inter-request delay (250ms). Per-tile manual clicks are infrequent enough to not need throttling.
- **Wrong cover for a volume** (locale mismatch, MangaDex has multiple editions, our `volume_number` disagrees with theirs) → Manual override always wins; user can paste a URL or upload a file to fix. The tooltip / failed-fetch error toast surfaces the problem.
- **MangaDex unavailable** → All `generate-web` endpoints return a clear error; the existing fallback chain (page-1 → number placeholder) means tiles never break visually. The Fetch Metadata flow should not roll back the metadata save just because cover fetch failed — they're independent operations from the user's perspective.
- **Volume number ambiguity** (omnibus, half-volumes like 7.5, oneshots without volume numbers) → If `volumes.volume_number` is null or no MangaDex cover matches, the volume keeps its page-1 thumbnail. We do NOT silently pick the closest cover — that's a worse failure mode than just falling back.
- **Re-extracting `SeriesCardMenu` could destabilize the existing UI** → Mitigated by keeping the new component visually identical and exporting the old name as a thin wrapper during the transition. The behavior tests around upload / URL / generate already cover the menu's existing paths.
- **Files in `.covers/` directory grow** → Each volume adds at most one new file (~30–80KB at 512px JPEG quality 85). For a library of 1000 volumes that's ~50MB worst case. Acceptable.

## Migration Plan

1. Ship the new `cover-art` capability and modified `manga-metadata-fetch` behavior.
2. No data migration required — `.cover.jpg` files are created on first manual action or first metadata save after upgrade.
3. Existing `vol-<filename>.jpg` page-1 thumbnails continue to be the fallback. Nothing is deleted.
4. Rollback: revert the code; the override files remain on disk but are inert (the old thumbnail route ignores them). Re-applying the change picks them up again with no further action.

## Open Questions

- Should the auto-fetch-on-metadata-save run synchronously inside the `POST /metadata` request, or asynchronously after the client resolves? Implementation will pick: client-driven sequential POSTs (simpler error reporting per-volume) is the leaning option, but if observed latency is noticeable, we can move to a fire-and-forget server-side background task.
- Should we record the MangaDex cover ID we used (e.g. as JSON sidecar `vol-<filename>.cover.json`)? Useful for debugging "why did this cover get picked" but adds a file. Defer until someone asks.
