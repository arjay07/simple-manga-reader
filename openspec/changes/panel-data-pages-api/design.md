## Context

The manga reader fetches all panel data for a volume in a single request (`GET /api/panel-data/:volumeId`) when smart panel zoom is enabled. `hasPanelData` remains false until this completes, blocking all panel zoom functionality. The data is stored in SQLite's `panel_data` table with one row per page. Each row is ~200-500 bytes of JSON, so a 200-page volume is ~40-100KB total — small, but the round-trip and JSON parsing still introduce a perceptible delay before panel zoom is available.

The existing data layer has `getPanelDataForVolume(vid)` (all pages) and `getPanelDataForPage(vid, page)` (single page). There is no batch-by-page-numbers query.

## Goals / Non-Goals

**Goals:**
- Panel zoom is usable within one small fetch (~3 pages) instead of waiting for the full volume
- Full volume data still loads in the background for cross-page transitions
- On-navigate refetch fills gaps if the user swipes faster than the background fetch

**Non-Goals:**
- Replacing the full-volume fetch entirely (it's still needed for lookahead)
- Caching/invalidation logic (the map is in-memory for the session)
- Pagination or streaming of the full-volume response

## Decisions

### New endpoint with `pages` query param

`GET /api/panel-data/:volumeId/pages?pages=4,5,6`

Returns `{ pages: PanelDataPage[] }` — just the panel data rows for the requested page numbers, ordered by page number. No `totalPages`/`processedPages`/`isComplete` fields (that's the full endpoint's job).

**Why a new route instead of a query param on the existing endpoint?** The existing endpoint returns status metadata (`totalPages`, `processedPages`, `isComplete`) which requires an extra query and is irrelevant for the sliding window use case. A dedicated route keeps both endpoints focused.

**Why not individual single-page fetches?** One request for 3 pages is better than 3 requests for 1 page each. The SQL `IN (...)` clause is a single query.

### Data layer: `getPanelDataForPages(volumeId, pageNumbers[])`

```sql
SELECT page_number, panels_json, reading_tree_json, page_type, processing_time_ms
FROM panel_data
WHERE volume_id = ? AND page_number IN (?, ?, ?)
ORDER BY page_number
```

Uses positional parameters for the `IN` clause (SQLite doesn't support array bind). The function builds the query dynamically based on the array length. Capped at 10 pages per request to prevent abuse.

### Two-phase fetch in the reader

**Phase 1 (immediate):** On mount (when `smartPanelZoom` is enabled), fetch `/api/panel-data/:vid/pages?pages=P-1,P,P+1` where P is `currentPage`. Merge the results into `panelDataMap`. Set `hasPanelData = true` if any data was returned. This unblocks panel zoom immediately.

**Phase 2 (background):** Immediately after Phase 1, fetch `/api/panel-data/:vid` (the full volume). Merge all pages into `panelDataMap` (existing entries are overwritten — the data is identical so this is a no-op in practice). Update status flags.

**On navigate:** When `currentPage` changes, check if `panelDataMap` has entries for `currentPage - 1`, `currentPage`, and `currentPage + 1`. If any are missing and Phase 2 hasn't completed, fetch the missing pages via the new endpoint. This is a safety net for fast swiping.

### Merge strategy

`panelDataMap` is a `Map<number, PanelDataPage>`. New data is merged by iterating the response and calling `map.set(page.pageNumber, page)`. Since the map is replaced with a new Map on each state update, React sees the change and re-renders.

The Phase 2 full-volume response replaces the entire map (same as current behavior). This naturally includes everything from Phase 1 plus all remaining pages.

### Track Phase 2 completion

A `fullDataLoadedRef = useRef(false)` tracks whether the full-volume fetch has completed. The on-navigate refetch only fires when `fullDataLoadedRef.current === false` and there are missing neighbors.

## Risks / Trade-offs

- **Extra request on mount** — Phase 1 adds one small request. Mitigation: it's 3 rows of data, typically <2KB, and it unblocks the UX immediately.
- **Race between Phase 1 and Phase 2** — If Phase 2 completes before a Phase 1 on-navigate fetch returns, the on-navigate response could overwrite newer data. Mitigation: the data is identical (same SQLite rows), so overwrites are harmless.
- **`IN` clause with dynamic parameters** — Requires building the SQL string dynamically. Mitigation: page numbers are validated as integers and the count is capped at 10.
