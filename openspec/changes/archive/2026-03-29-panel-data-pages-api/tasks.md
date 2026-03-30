## 1. Data Layer

- [x] 1.1 Add `getPanelDataForPages(volumeId: number, pageNumbers: number[]): PanelDataPage[]` to `src/lib/panel-data.ts`. Return empty array for empty input. Build `IN (...)` clause dynamically with positional parameters. Cap at 10 pages.

## 2. API Endpoint

- [x] 2.1 Create `src/app/api/panel-data/[volumeId]/pages/route.ts` with `GET` handler. Parse `pages` query param (comma-separated integers), validate volume exists, call `getPanelDataForPages`, return `{ pages: [...] }`. Return 400 if `pages` param missing, 404 if volume not found.

## 3. Reader Two-Phase Fetch

- [x] 3.1 Add `fullDataLoadedRef = useRef(false)` to track whether the full-volume fetch has completed. Reset to false when `volumeId` changes.
- [x] 3.2 Refactor the panel data fetch effect: Phase 1 fetches `/api/panel-data/:vid/pages?pages=P-1,P,P+1` and sets `hasPanelData = true` on response. Phase 2 immediately follows with the full-volume fetch, merging into the map and setting `fullDataLoadedRef.current = true`.
- [x] 3.3 Add on-navigate refetch: when `currentPage` changes and `fullDataLoadedRef.current === false`, check if any of `[currentPage - 1, currentPage, currentPage + 1]` are missing from `panelDataMap`. If so, fetch them via the multi-page endpoint and merge into the map.

## 4. Verification

- [x] 4.1 Run `npm run build` to confirm no TypeScript errors
- [ ] 4.2 Manually test: panel zoom is available immediately on reader load (before full volume data arrives)
- [ ] 4.3 Manually test: swiping to a new page works even if full volume data hasn't loaded yet
- [ ] 4.4 Manually test: full volume data loads in background and cross-page transitions work after it arrives
- [ ] 4.5 Manually test: new endpoint returns correct data for `?pages=1,2,3`
