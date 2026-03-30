## 1. Lift progress hook and create client wrapper

- [x] 1.1 Create a `SeriesClientContent` client component in `src/app/library/[seriesId]/` that calls `useVolumeProgress()` once and passes `progressMap` to child components
- [x] 1.2 Update `VolumeGrid` to accept an optional `progressMap` prop instead of calling `useVolumeProgress()` internally (keep backward compatibility for other usages)
- [x] 1.3 Update the series detail page to render `SeriesClientContent` wrapping the metadata section and volume grid

## 2. Continue Reading button

- [x] 2.1 Create `SeriesContinueButton` client component that takes `seriesId`, `volumes` (id, volume_number, page_count), and `progressMap` as props
- [x] 2.2 Implement reading destination logic: no progress → first volume; partial → last-read volume+page; volume finished → next volume; all done → last volume last page
- [x] 2.3 Implement no-profile state: show "Start Reading" and redirect to `/` on click
- [x] 2.4 Add play icon SVG and button styling with subtitle showing target volume/page
- [x] 2.5 Wire `SeriesContinueButton` into `SeriesClientContent` in the metadata area below volume count

## 3. Series progress bar

- [x] 3.1 Create `SeriesProgressBar` component that takes `volumes` and `progressMap`, computes aggregate pages read vs total, and renders a progress bar with label
- [x] 3.2 Handle edge cases: no progress (hide bar), null page_count volumes (exclude from calculation)
- [x] 3.3 Place `SeriesProgressBar` below the Continue Reading button in `SeriesClientContent`

## 4. Volume completion checkmarks

- [x] 4.1 Add a completion checkmark badge (green circle with check icon) to `VolumeGrid` volume cards when `currentPage >= pageCount`
- [x] 4.2 Ensure checkmark only renders when `pageCount` is not null

## 5. Verify and polish

- [x] 5.1 Verify the page builds without errors (`npm run build`)
- [x] 5.2 Test visual appearance: button states (start/continue/no-profile), progress bar, checkmarks on volume cards
