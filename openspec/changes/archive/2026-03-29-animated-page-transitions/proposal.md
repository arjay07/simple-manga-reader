## Why

Page navigation in the reader is currently instantaneous — tapping or swiping jumps directly to the new page with no visual continuity. On mobile this feels abrupt and breaks immersion; users lose spatial context of where they are in the manga. Adding animated transitions makes navigation feel natural and physical, especially on touch devices.

## What Changes

- **Horizontal paginated mode (single page only)**: Replace instant page switch with a draggable 3-canvas carousel strip. Users can drag with a finger to see pages slide in real-time; releasing past a 30% threshold snaps to the new page, releasing below springs back. Spread mode is unaffected.
- **Scroll wheel (horizontal mode)**: Mouse wheel triggers the same slide animation as a swipe, debounced so it can't fire again while an animation is in progress.
- **Vertical mode — snap-to-page**: Optional JS-controlled page snapping on touch release. When enabled, the scroll position snaps to the nearest page boundary via `scrollTo({ behavior: 'smooth' })`. Toggle on/off in reader settings.
- **New reader setting**: `verticalSnap: boolean` added to `ReaderSettings`.

## Capabilities

### New Capabilities
- `horizontal-swipe-carousel`: Draggable 3-canvas strip for horizontal (single-page) mode with threshold snap and scroll-wheel support
- `vertical-page-snap`: Optional JS-controlled snap-to-page for vertical scroll mode, toggled from reader settings

### Modified Capabilities
- `pdf-page-prerender`: Pre-render now covers both next AND previous pages simultaneously (two offscreen canvases) to support the carousel's 3-slot strip

## Impact

- **Code**: `MangaReader.tsx` (major refactor of touch/canvas logic), `VerticalScrollView.tsx` (snap logic), `ReaderSettingsModal.tsx` (new toggle), `reader-settings.ts` (new field)
- **Dependencies**: None new
- **APIs**: None changed
- **UX**: Spread mode and keyboard navigation are unchanged
