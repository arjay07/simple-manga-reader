## Why

Page navigation in the manga reader is handled independently by 6+ input handlers (keyboard, arrow buttons, click/tap, touch swipe, scroll wheel, scrub bar), each with its own logic for different page modes (normal, spread, panel zoom, vertical). This has led to inconsistent behavior: keyboard and arrow buttons bypass smart panel zoom entirely, scroll wheel is disabled in spread mode, animation varies by input method, and transitioning from a non-panel page to a panel page shows a flash of the unzoomed page before auto-zoom kicks in.

## What Changes

- **Introduce a unified navigation function** that all input handlers delegate to, replacing scattered `goNextPage()`/`goPrevPage()`/`advancePanel()`/`animateStrip()` calls with a single `navigateReading('forward' | 'back')` entry point.
- **Fix blank→panel page flash**: When navigating from a non-panel page (cover, full-bleed, blank) to a panel page, pre-render the next page zoomed to its first panel and slide it in seamlessly — matching the existing panel→panel cross-page transition.
- **Keyboard arrows respect panel zoom**: Arrow keys step through panels when smart panel zoom is active, matching swipe/wheel behavior.
- **Arrow buttons respect panel zoom**: On-screen arrow overlays use the same unified navigation path.
- **Container click supports backward navigation in panel mode**: Add left-zone backward tap in panel zoom mode (currently click only goes forward).
- **Scroll wheel works in spread mode**: Remove the early return that disables scroll wheel navigation in spread mode.
- **Consistent page turn animation**: All paginated-mode page turns use the carousel slide animation, not instant jumps (except direct page jumps from scrub bar/dropdown).

## Capabilities

### New Capabilities
- `unified-page-navigation`: Central navigation dispatch that handles all page modes (normal, spread, panel zoom, vertical) and all transition types (within-page panel steps, same-type cross-page, cross-type cross-page) with consistent animation.

### Modified Capabilities
- `smart-panel-zoom`: Cross-page transitions now handle non-panel→panel and panel→non-panel pages seamlessly, pre-rendering the target zoomed when applicable.

## Impact

- `src/components/Reader/MangaReader.tsx` — primary refactor target; all navigation handlers, `advancePanel`/`retreatPanel`, `goNextPage`/`goPrevPage`, `animateStrip`, keyboard/touch/click/wheel handlers.
- No API changes, no database changes, no new dependencies.
- Risk: carousel animation timing is delicate (strip slide → canvas copy → state update). Unifying the code paths must preserve existing transition smoothness for panel→panel and normal page turns.
