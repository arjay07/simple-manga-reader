## Context

The manga reader already saves reading progress to SQLite via a debounced `POST /api/progress` call (1s after page change). However, progress is never loaded back — the reader always opens at page 1. The DB schema (`reading_progress` table with `profile_id`, `volume_id`, `current_page`) and the save API are fully functional. The gap is purely on the read/resume side.

The reader page (`read/[seriesId]/[volumeId]/page.tsx`) is a server component that renders `MangaReader` (client component) with an `initialPage` prop currently hardcoded to 1.

## Goals / Non-Goals

**Goals:**
- Resume reading from saved position when opening a volume
- Survive page refresh without losing current position (close the debounce gap)
- Show per-volume reading progress in the library UI
- Provide a "Continue Reading" entry point for the most recently read volume

**Non-Goals:**
- Guest/anonymous progress (profile is required)
- Sub-page scroll position tracking in vertical mode (page-level granularity is sufficient)
- Cross-device sync (both localStorage and SQLite are local)
- Reading history or analytics beyond current position

## Decisions

### 1. Server-side progress fetch on volume open

The reader page component (`page.tsx`) will query SQLite directly for the saved `current_page` for the given `profileId + volumeId` and pass it as `initialPage` to `MangaReader`.

**Why server-side:** The page is already a server component with access to the DB singleton. No extra API call needed. The progress is available on first render with no flash of page 1.

**Alternative considered:** Client-side fetch in `MangaReader` `useEffect`. Rejected because it causes a visible jump from page 1 to the saved page.

### 2. localStorage as write-through cache for refresh survival

On every page change, write `progress:{profileId}:{volumeId}` → `currentPage` to localStorage immediately (synchronous, no debounce). The existing 1s-debounced API call to SQLite continues as-is.

On mount, `MangaReader` reads both `initialPage` (from server/DB) and localStorage. It uses `Math.max(initialPage, localStoragePage)` as the true starting page, since the higher value is more recent.

**Why localStorage over sendBeacon:** localStorage writes are synchronous and guaranteed to persist before the page unloads. `sendBeacon` is fire-and-forget with no delivery guarantee. localStorage also makes the client self-sufficient for refresh without waiting for a server round-trip.

**Cache cleanup:** Clear the localStorage key when the debounced DB save succeeds (the DB is now up to date). Also clear on volume close/navigation away.

### 3. Single-volume progress API endpoint

Add a query parameter to `GET /api/progress` supporting `?profileId=X&volumeId=Y` to fetch progress for a specific volume. The existing all-progress query (just `?profileId=X`) remains for the library UI.

**Why not a new route:** Keeps the API surface small. One endpoint, optional filter.

### 4. Library progress UI via existing API

The series detail page and library page will call `GET /api/progress?profileId=X` to get all progress, then match against displayed volumes. No new DB queries needed — the existing endpoint already joins with series/volume metadata.

The "Continue Reading" section uses the first result (already sorted by `updated_at DESC`).

## Risks / Trade-offs

**[localStorage/DB divergence]** → localStorage may have a higher page than DB if the user refreshes during the debounce window. Mitigated by `Math.max()` logic — always takes the more recent value. DB catches up on next debounced save.

**[Stale localStorage across profiles]** → If user switches profile, old localStorage keys from another profile remain. Mitigated by keying on `profileId` — each profile's progress is isolated. Optionally clear all progress keys on profile switch.

**[Progress for deleted volumes]** → If a volume PDF is removed from disk, orphan progress records remain. Low impact — they're ignored if the volume doesn't exist. Can be cleaned up during the existing startup scan in `instrumentation.ts` if desired later.
