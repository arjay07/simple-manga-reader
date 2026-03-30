## Why

Reading manga on mobile often requires seeing fine details in individual panels, but the reader currently has no way to zoom in — the page is always shown at full-page scale. Double-tap zoom is the standard interaction in every major mobile manga and comic reader, and its absence makes small text and dense artwork harder to read.

## What Changes

- Double-tapping anywhere on a page in single-page carousel mode zooms in (2.5×) centered on the tap point
- While zoomed, one-finger drag pans around the page (clamped to page bounds)
- Double-tapping again while zoomed returns to normal (1×) view
- While zoomed, swipe navigation is disabled (swipe pans instead)
- While zoomed, single-tap only toggles the toolbar — no page turning
- Zoom resets automatically when navigating to a different page
- Single-tap actions (tap-to-turn) gain a ~280ms delay in paginated mode to allow double-tap detection

## Capabilities

### New Capabilities

- `reader-zoom`: Double-tap point zoom in the manga reader's single-page carousel mode, with pan support while zoomed

### Modified Capabilities

- (none — vertical scroll and spread mode are unaffected)

## Impact

- `src/components/Reader/MangaReader.tsx` — touch handling, new zoom state, CSS transform on canvas
- No API changes, no database changes, no new dependencies
- The 280ms single-tap delay affects tap-to-turn responsiveness in paginated mode
