## Why

The series detail page currently shows only a static list of volumes with no awareness of reading state. Users have to remember where they left off and manually navigate to the right volume and page. Adding progress-aware UI to the series page makes it the natural "home base" for continuing a series.

## What Changes

- Add a prominent "Start Reading" / "Continue Reading" button to the series detail page that links directly to the appropriate volume and page
- Show an overall series reading progress bar (pages read / total pages)
- Add per-volume progress indicators on volume cards in the series view
- Add completion checkmarks on fully-read volumes
- When a user finishes the last page of a volume, "Continue Reading" advances to the next volume
- When no profile is selected, the button prompts the user to select a profile

## Capabilities

### New Capabilities
- `series-continue-reading`: Smart "Start Reading"/"Continue Reading" button on the series detail page that resolves the next reading destination based on profile progress
- `series-progress-display`: Overall series progress bar and per-volume completion marks on the series detail page

### Modified Capabilities
- `library-progress-ui`: Adding per-volume progress bars and completion checkmarks to volume cards on the series detail page (extends existing volume card progress display)

## Impact

- `src/app/library/[seriesId]/page.tsx` — series detail page layout, new client components
- `src/components/Library/VolumeGrid.tsx` — volume cards need progress indicators and completion marks
- `/api/progress` — may need a query for all progress in a series (currently supports single volume or all volumes for a profile)
- No new dependencies or database changes required — all data is already available via existing reading_progress table
