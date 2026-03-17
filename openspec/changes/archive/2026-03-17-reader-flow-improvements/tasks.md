## 1. Next Volume Navigation — Server Side

- [x] 1.1 Add adjacent volume queries to `src/app/read/[seriesId]/[volumeId]/page.tsx` — query next and previous volumes by `volume_number` and pass `nextVolumeId`, `nextVolumeTitle`, `prevVolumeId`, `prevVolumeTitle` as props to `MangaReader`

## 2. Next Volume Navigation — Client Side

- [x] 2.1 Add new props to `MangaReader` interface: `nextVolumeId?`, `nextVolumeTitle?`, `prevVolumeId?`, `prevVolumeTitle?`
- [x] 2.2 Create `EndOfVolumeOverlay` component — slide-up card with "Continue to Vol. X" / "Back to Series" / "Series Complete" variants, dismissible via tap or Escape
- [x] 2.3 Add end-of-volume state to `MangaReader` — show overlay when `currentPage === totalPages`, triggered by page navigation attempts past the last page
- [x] 2.4 Add start-of-volume state — show overlay when user attempts to go before page 1 and `prevVolumeId` exists
- [x] 2.5 Update `goNextPage`/`goPrevPage` to trigger overlay at boundaries instead of silently clamping

## 3. Library Hero Resume Card

- [x] 3.1 Refactor `ContinueReading` component — split entries into hero card (entry 0) and horizontal scroll (entries 1–5)
- [x] 3.2 Build hero card layout — full-width card with series cover thumbnail, series title, volume title, progress bar, page count, and "Resume" link
- [x] 3.3 Handle single-entry case — show only hero card when exactly one entry exists, no scroll section

## 4. Verification

- [x] 4.1 Verify build passes with `npm run build`
- [x] 4.2 Manual test: navigate to last page of a mid-series volume, confirm overlay appears and "Continue" works
- [x] 4.3 Manual test: navigate before page 1 of a non-first volume, confirm previous volume overlay
- [x] 4.4 Manual test: library page shows hero card for most recent entry with remaining entries in scroll
