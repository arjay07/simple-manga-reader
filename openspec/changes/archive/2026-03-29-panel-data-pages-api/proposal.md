## Why

Smart panel zoom is blocked until the full-volume panel data fetch completes. For large volumes this causes a noticeable delay before the user can start zooming into panels. The reader only needs data for the current page and its neighbors to begin — the rest can load in the background.

## What Changes

- **New API endpoint** `GET /api/panel-data/:volumeId/pages?pages=1,2,3` returns panel data for only the requested page numbers. Lightweight response with no status/totalPages overhead.
- **New data layer function** `getPanelDataForPages(volumeId, pageNumbers[])` queries SQLite for specific pages using an `IN (...)` clause.
- **Two-phase fetch in the reader**: Phase 1 fetches current + prev + next pages immediately, enabling panel zoom right away. Phase 2 fetches the full volume in the background and merges into the existing map.
- **On-navigate refetch**: If the user navigates before the full-volume fetch completes and the target page's neighbors are missing from the map, a quick fetch of the sliding window fills the gap.

## Capabilities

### New Capabilities

- `panel-data-pages-api`: API endpoint to retrieve panel data for a specific set of pages within a volume

### Modified Capabilities

- `panel-data-storage`: New `getPanelDataForPages` function for multi-page filtered queries

## Impact

- `src/app/api/panel-data/[volumeId]/pages/route.ts` — new API route
- `src/lib/panel-data.ts` — new `getPanelDataForPages` function
- `src/components/Reader/MangaReader.tsx` — two-phase fetch logic, on-navigate refetch when map is incomplete
- No database schema changes (queries existing `panel_data` table)
