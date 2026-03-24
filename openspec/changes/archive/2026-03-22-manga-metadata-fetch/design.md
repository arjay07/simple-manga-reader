## Context

The app currently has no mechanism to enrich series with external metadata. Series records in SQLite contain only filesystem-derived fields (title, file path, cover image). The MangaDex public REST API (`https://api.mangadex.org`) requires no API key and provides descriptions, author/artist relationships, and a stable series ID — making it a natural fit for on-demand enrichment.

## Goals / Non-Goals

**Goals:**
- Allow an admin to trigger a MangaDex lookup for any series from the series detail page
- Persist the fetched description, author, and MangaDex ID to SQLite
- Display description and author on the series detail page when present

**Non-Goals:**
- Automatic background syncing of metadata on startup
- Bulk metadata fetch for all series at once
- Fetching cover art from MangaDex (local covers are already handled)
- Displaying genres, tags, or publication status (deferred to future changes)
- Editing or overriding fetched metadata manually in the UI

## Decisions

### 1. On-demand fetch, not automatic
**Decision:** Metadata is fetched only when an admin clicks "Fetch Metadata" on a series detail page.

**Rationale:** Series folder names may not match MangaDex titles exactly. Presenting the top search result and letting the admin confirm avoids silently storing wrong metadata. Automatic fetching on startup would also add latency and network dependency to server boot.

**Alternative considered:** Fetch automatically during `scanMangaDirectory()` on startup — rejected because it couples boot time to network availability and gives no opportunity to review matches.

### 2. Two-step API: search then save
**Decision:** Expose two API routes:
- `GET /api/manga/[seriesId]/metadata/search` — calls MangaDex search, returns top candidates
- `POST /api/manga/[seriesId]/metadata` — saves chosen metadata to the DB

**Rationale:** Separating search from save lets the UI show a preview of what will be stored before committing. This is important because MangaDex search is fuzzy and the top result may not always be correct.

**Alternative considered:** Single POST that searches and saves in one call — rejected because it gives no chance to review the match.

### 3. Plain `fetch`, no new npm dependency
**Decision:** Use the built-in `fetch` (available in Node 18+) to call MangaDex. No axios or other HTTP library.

**Rationale:** The project already runs Next.js 15 on Node 18+. Adding a dependency for a few GET requests would be unnecessary bloat.

### 4. Schema migration via ALTER TABLE
**Decision:** Add `description TEXT`, `author TEXT`, and `mangadex_id TEXT` columns to the existing `series` table using `ALTER TABLE … ADD COLUMN IF NOT EXISTS` at DB initialization time.

**Rationale:** better-sqlite3 runs synchronously and the existing schema is created on first access in `src/lib/db.ts`. Adding columns with `IF NOT EXISTS` is safe to run on every startup against an existing database.

**Alternative considered:** A separate `series_metadata` table — rejected as unnecessary complexity for three scalar fields.

### 5. Fetch button gated behind admin mode
**Decision:** The "Fetch Metadata" button is only visible when `AdminProvider` reports admin mode is active.

**Rationale:** Consistent with how other destructive/mutating actions (delete series, rescan) are already gated in the app.

## Risks / Trade-offs

- **MangaDex API availability** → The feature degrades gracefully: if the API is unreachable the button shows an error toast and the series page continues to work normally with no metadata.
- **Title mismatch** → Folder names like "Dragon_Ball" may not match MangaDex's "Dragon Ball". The search endpoint handles minor variations; the two-step UX lets admins reject bad matches.
- **Rate limiting** → MangaDex enforces rate limits. On-demand single-series fetch is well within limits; no retry logic needed for MVP.
- **Stale metadata** → Stored metadata is a point-in-time snapshot. No auto-refresh is planned; admins can re-fetch manually if needed.

## Migration Plan

1. Update `src/lib/db.ts` to add the three new columns on startup (safe to deploy against existing DB).
2. Deploy new API routes and updated series detail page.
3. No rollback complexity — columns default to NULL and the UI handles missing metadata gracefully.
