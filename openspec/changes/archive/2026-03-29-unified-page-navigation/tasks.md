## 1. Create unified navigation dispatch

- [x] 1.1 Create `navigateReading('forward' | 'back')` callback in MangaReader that implements the decision tree: panel zoom with panels → advancePanel/retreatPanel, panel zoom without panels → check next page for panels or animateStrip, spread mode → goNextPage/goPrevPage, single page → animateStrip
- [x] 1.2 Set `autoZoomDirectionRef.current` inside `navigateReading` based on direction, so callers don't need to manage it

## 2. Extend advancePanel/retreatPanel for non-panel→panel transitions

- [x] 2.1 Extract the shared "pre-render zoomed canvas and slide strip" logic from advancePanel's cross-page branch into a reusable helper (e.g., `slideToZoomedPage`)
- [x] 2.2 Update advancePanel: when current page has no panels, check if next page has panels. If yes, call the extracted helper to pre-render next page zoomed to first panel and slide in. If no, return false.
- [x] 2.3 Update retreatPanel: same pattern — when current page has no panels, check if prev page has panels. If yes, pre-render zoomed to last panel and slide in. If no, return false.
- [x] 2.4 Handle panel→non-panel: when advancePanel reaches the last panel and the next page has no panels, exit zoom and return false so navigateReading falls through to animateStrip

## 3. Rewire input handlers to use navigateReading

- [x] 3.1 Keyboard handler: replace direct goNextPage/goPrevPage calls with navigateReading, mapping ArrowLeft/ArrowRight to 'forward'/'back' based on effectiveDirection
- [x] 3.2 Arrow button handler: replace goNextPage/goPrevPage calls with navigateReading
- [x] 3.3 Container click handler: replace advancePanel/goNextPage with navigateReading; add left-zone backward navigation for panel zoom mode
- [x] 3.4 Touch swipe handler: replace advancePanel/retreatPanel/animateStrip calls with navigateReading (keep swipe gesture detection, double-tap, and drag/spring-back as-is)
- [x] 3.5 Scroll wheel handler: replace advancePanel/retreatPanel/animateStrip calls with navigateReading; remove the early return for spread mode

## 4. Verify and clean up

- [x] 4.1 Ensure goNextPage/goPrevPage are only called by commitPageChange, advancePanel/retreatPanel internals, handlePageChange, and navigateReading's spread-mode branch — remove any remaining direct calls from input handlers
- [x] 4.2 Verify that all 6 input methods produce identical behavior for each mode: single page, spread, panel zoom with panels, panel zoom without panels, end/start of volume overlays
- [x] 4.3 Run `npm run build` to verify no TypeScript or compilation errors
