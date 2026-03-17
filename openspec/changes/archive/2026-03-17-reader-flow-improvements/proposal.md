## Why

Reading flow breaks at volume boundaries — when a user finishes the last page, they must manually back out to the series page, find the next volume, and tap into it. This friction interrupts the reading session. Additionally, the library's "Continue Reading" section treats all entries equally, making it harder to quickly resume the most recent session.

## What Changes

- **Next/previous volume navigation in reader**: When the user reaches the last page, a slide-up card offers "Continue to next volume" with a direct link. Attempting to go before page 1 offers the previous volume. When no next volume exists, shows a "series complete" message with a link back to the series page.
- **Hero resume card on library page**: The most recently read volume is promoted to a prominent full-width card at the top of the library, with series cover, title, volume, progress bar, and a "Resume" action. Remaining continue-reading entries (up to 5) stay in the existing horizontal scroll below it.

## Capabilities

### New Capabilities
- `next-volume-navigation`: End-of-volume overlay in the reader that links to the next/previous volume in the series, enabling uninterrupted reading across volumes.

### Modified Capabilities
- `library-progress-ui`: The "Continue Reading" section gains a hero card layout — the most recent entry is promoted to a full-width card, with remaining entries in the existing scroll.

## Impact

- **Reader server component** (`src/app/read/[seriesId]/[volumeId]/page.tsx`): New query for adjacent volumes, passed as props to `MangaReader`.
- **MangaReader client component**: New props (`nextVolumeId`, `prevVolumeId`, etc.), end-of-volume overlay component, and navigation logic when going past first/last page.
- **ContinueReading component** (`src/components/Library/ContinueReading.tsx`): Layout change — hero card for first entry, horizontal scroll for rest.
- No new API endpoints, database changes, or dependencies required.
