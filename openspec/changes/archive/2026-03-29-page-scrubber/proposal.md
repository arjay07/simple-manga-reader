## Why

The manga reader currently offers no way to quickly scrub through pages or jump to a specific page beyond sequential navigation (arrows, swipe, tap). For longer volumes, this makes it tedious to find a specific page. A YouTube-style scrub bar with thumbnail previews and a page selector dropdown would make navigation fast and intuitive.

## What Changes

- Add a page scrub bar to the top edge of the bottom bar, with a draggable handle for quick page navigation
- When bars are hidden, show a thin persistent progress line at the bottom of the screen (like YouTube's minimized progress bar)
- Show page thumbnail previews and page number labels above the scrub position on hover/drag
- Convert the "Page X / Y" text into a clickable dropdown that opens a scrollable page list for direct page jumping
- Thumbnails are rendered lazily via pdfjs on first hover and cached for instant revisits

## Capabilities

### New Capabilities
- `page-scrub-bar`: Interactive scrub bar with draggable handle, thin always-visible progress line, and thumbnail preview on hover/drag with page number label
- `page-selector-dropdown`: Scrollable dropdown triggered by clicking the page indicator text, allowing direct jump to any page

### Modified Capabilities

_(none)_

## Impact

- **Components modified:** `ReaderBottomBar.tsx` (major expansion — scrub bar, dropdown, thumbnail rendering)
- **Components modified:** `MangaReader.tsx` (pass `pdfDocument` and `onPageChange` callback to bottom bar)
- **New dependencies:** None (uses existing pdfjs-dist for thumbnail rendering)
- **State:** New state for dropdown open/close, scrub position, thumbnail cache
- **Performance:** Lazy thumbnail rendering with caching keeps memory use proportional to pages actually previewed
