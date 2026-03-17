## Context

The series detail page (`/library/[seriesId]/page.tsx`) is a server component that renders series metadata and a `VolumeGrid` of volume cards. Reading progress is already fetched client-side via `useVolumeProgress()` hook, which calls `GET /api/progress?profileId=N` and returns all progress entries for the active profile. The `VolumeGrid` already shows progress bars on volume cards that have saved progress.

The active profile is resolved client-side via `useProfile()` from `ProfileProvider`. The server has no knowledge of which profile is active.

## Goals / Non-Goals

**Goals:**
- Add a "Start Reading" / "Continue Reading" button to the series detail page that links to the correct volume and page
- Show overall series reading progress (aggregate bar)
- Add completion checkmarks on fully-read volume cards
- Handle the no-profile state by prompting profile selection

**Non-Goals:**
- Changing the `/api/progress` endpoint (existing endpoint already returns all data needed)
- Adding "Re-read" or "Finished series" states — just show Continue pointing to last position
- Server-side progress resolution — keep the client-side pattern consistent with the rest of the app

## Decisions

### 1. New `SeriesContinueButton` client component on the series page

The series detail page is a server component. The button needs profile + progress data, so it must be a client component. Create `SeriesContinueButton` that:
- Takes `seriesId` and `volumes` (with id, volume_number, page_count) as props from the server
- Uses `useProfile()` to get the active profile
- Uses the existing `useVolumeProgress()` hook to get the progress map
- Computes the reading destination:
  - No progress → "Start Reading" → Volume 1, Page 1
  - Has progress, last-read volume not finished → "Continue Reading" → that volume, that page
  - Has progress, last-read volume finished → "Continue Reading" → next volume, Page 1
  - All volumes finished → "Continue Reading" → last volume, last page
- No profile → renders the button but navigates to `/` (profile selector) on click

**Why client component over API-driven:** Consistent with existing pattern. `VolumeGrid` already fetches all progress client-side. Reusing `useVolumeProgress()` avoids a duplicate request.

**Alternative considered:** Server-side with profileId query param. Rejected because it breaks the existing pattern where profile is always client-side, and would require plumbing profileId through URL state.

### 2. Reuse `useVolumeProgress()` in both VolumeGrid and SeriesContinueButton

Both components need the same progress data. Rather than duplicating fetches, lift the `useVolumeProgress()` call to the series page level and pass the result down. This means creating a thin client wrapper component (`SeriesContent` or similar) that calls the hook once and passes `progressMap` to both children.

**Why:** Avoids two identical API calls on page load.

**Alternative considered:** React context for progress. Overkill for two sibling components — prop drilling is simpler here.

### 3. Completion detection: currentPage >= pageCount

A volume is "complete" when `currentPage >= pageCount`. This is the same implicit check already used in `VolumeProgressBar` (it caps at 100%). Make it explicit with a helper function.

### 4. Volume completion checkmark on volume cards

Add a small checkmark badge (green circle with check icon) overlaying the top-right of completed volume cards. This is a visual addition to `VolumeGrid` — when `currentPage >= pageCount`, render the badge.

### 5. Overall series progress bar

A new `SeriesProgressBar` component that sums `currentPage` across all volumes with progress and divides by total page count across all volumes. Renders a progress bar with "X / Y pages (Z%)" text.

### 6. Button placement

The button sits in the metadata section, below the volume count text and above the volumes grid. On mobile it appears full-width below the cover. The progress bar sits directly below the button.

## Risks / Trade-offs

- **Double render on load:** The button shows "Start Reading" initially, then flips to "Continue Reading" after progress loads. This is acceptable and consistent with how `VolumeGrid` already behaves (progress bars appear after load). → Mitigate with a loading skeleton or brief opacity transition.
- **Volumes without page_count:** If `page_count` is null (PDF not scanned), completion detection fails. → Treat as incomplete; progress bar shows page number without percentage.
- **Profile selector redirect:** Navigating to `/` loses the user's place. → After profile selection, the user returns to library and can re-navigate. This is acceptable for the edge case of no profile being set.
