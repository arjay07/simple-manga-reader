## 1. Zoom State & Double-Tap Detection

- [x] 1.1 Add refs for zoom state: `zoomScaleRef`, `zoomOriginRef` (`{x, y}` in canvas-local coords), `panRef` (`{x, y}`), and a `lastTapRef` (`{time, x, y}`) for double-tap tracking
- [x] 1.2 Add `isZoomed` React state (boolean) to drive behavior fork and re-renders
- [x] 1.3 Implement `detectDoubleTap(touchX, touchY): boolean` helper — returns true if a touch lands within 280ms and 40px of the previous tap, and updates `lastTapRef`

## 2. Zoom Transform

- [x] 2.1 Wrap the current-slot canvas in a new `<div ref={zoomWrapperRef}>` inside the carousel's center slot div
- [x] 2.2 Apply zoom CSS: set `transform-origin` to the tap point (in canvas-local coords) and `transform: scale(zoomScale) translate(panX/zoomScale, panY/zoomScale)` on the wrapper; use a `zoomTransitioning` ref to apply `transition: transform 200ms ease-out` only during zoom in/out (not during pan)
- [x] 2.3 Implement `enterZoom(tapX, tapY)` — converts screen tap coords to canvas-local coords, sets `zoomScaleRef` to 2.5, resets `panRef`, sets `isZoomed = true`, updates wrapper transform
- [x] 2.4 Implement `exitZoom()` — resets scale to 1, pan to `{0, 0}`, sets `isZoomed = false`, applies transition, updates wrapper transform

## 3. Pan While Zoomed

- [x] 3.1 Implement `computePanBounds()` — reads canvas display size and container size, returns `{ maxX, maxY }` clamping limits: `max(0, (canvasDisplaySize * zoom - containerSize) / 2)`
- [x] 3.2 In `handleTouchMove`: when `isZoomed`, update `panRef` by the drag delta, clamp to bounds, and directly set `zoomWrapperRef.current.style.transform` (no React state update, for smoothness)
- [x] 3.3 Guard: when `isZoomed`, skip calling `setStripTransform` (no carousel drag)

## 4. Gesture Routing Updates

- [x] 4.1 Refactor `handleTouchStart` to record `touchStartRef` regardless of zoom state (needed for both pan and double-tap detection)
- [x] 4.2 Refactor `handleTouchEnd` in non-spread paginated mode: call `detectDoubleTap`; if double-tap detected, call `enterZoom` or `exitZoom` and return; otherwise schedule single-tap action in `setTimeout(fn, 280)`, storing the timer in a `tapTimerRef` so it can be cancelled
- [x] 4.3 At the top of the double-tap branch, clear `tapTimerRef` if it's pending (cancels the in-flight single-tap action)
- [x] 4.4 When `isZoomed` and touch ends without a double-tap, skip carousel swipe logic (`animateStrip`, `springBack`) — pan was already applied in `handleTouchMove`

## 5. Zoom Reset on Page Change

- [x] 5.1 Add a `useEffect` watching `currentPage` that calls `exitZoom()` (no animation) whenever the page changes — ensures zoom never persists across navigation

## 6. Verify Spec Coverage

- [ ] 6.1 Manually test: double-tap to zoom in, pan around, double-tap to zoom out
- [ ] 6.2 Manually test: swipe while zoomed pans (does not navigate pages)
- [ ] 6.3 Manually test: single tap while zoomed toggles toolbar, does not turn page
- [ ] 6.4 Manually test: navigate to next page while zoomed — next page appears at 1×
- [ ] 6.5 Manually test: tap-to-turn still works in normal view (with 280ms delay)
- [ ] 6.6 Manually test: double-tap in vertical and spread modes has no effect
- [x] 6.7 Run `npm run build` to confirm no TypeScript errors
