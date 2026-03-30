## 1. Settings

- [x] 1.1 Add `verticalSnap: boolean` (default `false`) to `ReaderSettings` interface in `reader-settings.ts`
- [x] 1.2 Add `verticalSnap` to `READER_DEFAULTS` and ensure `parseReaderSettings` returns it correctly

## 2. Reader Settings Modal

- [x] 2.1 Add "Snap to Pages" toggle to `ReaderSettingsModal.tsx`, visible only when `readingDirection === 'vertical'`

## 3. Vertical Snap in VerticalScrollView

- [x] 3.1 Add `snapEnabled` prop to `VerticalScrollView`
- [x] 3.2 Add `isProgrammaticScrollRef` ref to suppress snap after programmatic scrolls
- [x] 3.3 Implement `onTouchEnd` handler: find canvas whose center is nearest to viewport center, call `scrollTo({ top: canvas.offsetTop, behavior: 'smooth' })`
- [x] 3.4 Pass `snapEnabled={settings.verticalSnap}` from `MangaReader.tsx` to `VerticalScrollView`

## 4. Horizontal Carousel Strip

- [x] 4.1 Add `prevCanvasRef` and `nextCanvasRef` to `MangaReader.tsx`
- [x] 4.2 Add `stripRef` ref for the flex-row container div
- [x] 4.3 Add `isAnimatingRef` and `dragOffsetRef` refs
- [x] 4.4 Replace the single-canvas layout with a 300vw strip: `[prevCanvasRef][canvasRef][nextCanvasRef]`, initial `translateX(-100vw)`
- [x] 4.5 Add render calls for prev and next canvases in the page-render `useEffect` (current first, then next, then prev via `setTimeout(0)`)
- [x] 4.6 Remove the old `offscreenCanvasRef` / `prerenderTaskRef` / `prerenderTimerRef` / `prerenderedPageRef` pre-render system

## 5. Touch Drag

- [x] 5.1 Add `onTouchMove` handler: update `dragOffsetRef`, apply `strip.style.transform` directly (no CSS transition)
- [x] 5.2 Update `onTouchEnd` handler: check threshold (30% of `window.innerWidth`), call `animateStrip(direction)` or `springBack()`
- [x] 5.3 Implement `animateStrip(direction)`: enable CSS transition, set `translateX(±100vw)`, on `transitionend` update `currentPage`, reset `translateX(-100vw)` without transition, set `isAnimatingRef = false`
- [x] 5.4 Guard `onTouchStart` to no-op when `isAnimatingRef` is true

## 6. Scroll Wheel

- [x] 6.1 Add `onWheel` handler to the reader container: call `animateStrip(direction)` based on `deltaY` sign, guarded by `isAnimatingRef`
- [x] 6.2 Call `e.preventDefault()` in the wheel handler when in horizontal single-page mode
- [x] 6.3 Ensure `onWheel` is a no-op in vertical mode and spread mode

## 7. Edge Cases & Cleanup

- [x] 7.1 Ensure strip reset after animation uses `requestAnimationFrame` to batch transform reset with page state update (avoid flash)
- [x] 7.2 Verify end-of-volume overlay still triggers when dragging past the last page
- [x] 7.3 Verify resize handler re-renders all three strip canvases (not just current)
- [x] 7.4 Verify RTL reading direction correctly maps drag direction to page navigation
- [x] 7.5 Remove any now-unused refs/state leftover from the old single-canvas system
