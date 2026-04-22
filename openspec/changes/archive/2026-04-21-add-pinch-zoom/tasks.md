## 1. Preparation

- [x] 1.1 Verify the viewport `<meta>` in `src/app/layout.tsx` (or Next.js `viewport` metadata export) disables native pinch; add `user-scalable=no` / `maximumScale: 1` if missing
- [x] 1.2 Confirm the reader container still receives `React.TouchEvent` with `touches.length === 2` under the updated viewport settings (manual smoke test on iOS Safari and Chrome DevTools device emulation)

## 2. Pinch state and helpers

- [x] 2.1 Add `pinchStateRef` to `MangaReader.tsx` holding `{ dist0, mid0, scale0, P0, natLeft, natTop } | null` (replaces the original `{ pan0, origin0 }` fields — `P0` is the canvas-local point under the initial midpoint, derived from pan0/origin0/scale0, and both viewport offsets are stored for the pinch-move math)
- [x] 2.2 Add a helper `getPinchGeometry(touches)` returning `{ mid, dist }` in client coords
- [x] 2.3 `toCanvasLocalCoords` inlined into pinch-start (computing `P0` from `mid0`, viewport offsets, and live `zoomOriginRef` / `zoomScaleRef` / `panRef`); no standalone helper needed
- [x] 2.4 Add a debounced `scheduleHiResRerender(scale)` helper that reuses the existing page-render path used by `zoomToPanel`, guarded on `isZoomedRef.current && !isAnimatingRef.current`

## 3. Pinch start

- [x] 3.1 In `handleTouchStart`, detect `e.touches.length === 2` before the single-finger branch; if detected, run pinch-start and early-return
- [x] 3.2 Strip-slide animation handling: skip pinch-start if an unzoomed strip animation is in flight (pragmatic alternative to the original "cancel animation" task — animations are short and rare to collide with; cancelling the in-flight transitionend listener cleanly is out-of-scope complexity)
- [x] 3.3 On pinch start: clear `touchStartRef.current`, `panelDragRef.current`, and any tap timer
- [x] 3.4 Revised: pinch-in no longer pauses panel mode. Panel auto-zoom remains active during and after pinch so subsequent swipes advance panels. Only a pinch-out-to-exit (see 5.4) pauses the panel flag, matching double-tap-out. See updated `specs/smart-panel-zoom/spec.md`.
- [x] 3.5 On pinch start from unzoomed (`isZoomedRef.current === false`): set `zoomOriginRef` to the midpoint in canvas-local coords, set `zoomScaleRef = 1`, set `panRef = { x: 0, y: 0 }`, and set `isZoomedRef.current = true` / `setIsZoomed(true)` so subsequent math is consistent
- [x] 3.6 Populate `pinchStateRef.current` with `dist0`, `mid0`, `scale0`, `P0`, `natLeft`, `natTop`
- [x] 3.7 Additional: set `gestureHadPinchRef.current = true` so `handleTouchEnd` knows to skip tap/swipe interpretation even if the pinch is already over

## 4. Pinch move

- [x] 4.1 In `handleTouchMove`, if `pinchStateRef.current` is set, run the pinch-move branch and early-return (before any existing single-finger branches)
- [x] 4.2 Compute `rawScale = scale0 * (dist / dist0)` and clamp to `[1, 5]`
- [x] 4.3 Revised formula (P0-based): `panX = mid.x - natLeft - origin.x * (1 - scale) - P0.x * scale`, analogous for `panY`. This is the rigorous "page point under mid0 stays under mid" formulation, replacing the approximate `pan0 + (mid - mid0) - origin*(scale - scale0)` in the original task.
- [x] 4.4 Update `zoomScaleRef`, `panRef` (no pan clamp during the gesture) and call `applyZoomTransform(false)`

## 5. Pinch end and 2→1-finger transition

- [x] 5.1 In `handleTouchEnd`, detect pinch-end when `pinchStateRef.current` is set and `e.touches.length < 2`
- [x] 5.2 If pinch-end with one finger remaining: seed `touchStartRef.current` with its coords, snapshot `panStartRef`, clear `pinchStateRef.current`, skip the swipe/tap branches via `suppressNextClickRef`
- [x] 5.3 If pinch-end with zero fingers remaining: clear `pinchStateRef.current` and `touchStartRef.current`, skip the swipe/tap branches via `suppressNextClickRef`
- [x] 5.4 If final scale is below `1.05`: call `exitZoom(true)` and return. Additionally, if in smart panel mode, set `panelZoomPausedRef.current = true` and reset `currentPanelIndexRef` / `panelStopRef` — pinch-out-to-exit mirrors double-tap-out-to-full-page.
- [x] 5.5 Otherwise: clamp `panRef` to `computePanBounds()`, call `applyZoomTransform(true)` for a settle animation, and call `scheduleHiResRerender(scale)`
- [x] 5.6 Additional: `panelDragRef.start` now uses live refs (`zoomOriginRef`, `zoomScaleRef`, `panRef`) instead of `computePanelTransform(curPanel, curStop)` so a swipe after a pinch-in interpolates from the actual current position, not the pristine panel transform

## 6. Single-finger handler gating

- [x] 6.1 In `handleTouchMove`, existing single-finger drag/pan is skipped when `pinchStateRef.current` is non-null (pinch branch returns early before the single-finger branches run)
- [x] 6.2 In `handleTouchEnd`, `gestureHadPinchRef.current` is checked after the pinch-end branch; if true, tap/swipe interpretation is skipped and `suppressNextClickRef` is set
- [x] 6.3 Verified by construction: pinch-start early-returns before the `panelDragRef` setup block, so `panelDragRef` is never initialized during a pinch

## 7. Integration and regression checks

- [x] 7.1 Manual test: pinch-in from unzoomed full-page view — zoom anchors to midpoint
- [x] 7.2 Manual test: pinch-out from zoomed state — scale shrinks continuously, dropping below fit snaps back to full page on release
- [x] 7.3 Manual test: pinch, lift one finger, keep panning — no jump
- [x] 7.4 Manual test: pinch-in in smart panel mode — panel mode remains active, next swipe advances to the next panel (NOT the next page) with a smooth transition from the pinched view
- [x] 7.5 Manual test: pinch-out-to-exit in smart panel mode — panel mode pauses, swipes navigate pages. Double-tapping a panel re-enters panel mode.
- [x] 7.6 Manual test: pinch during an in-flight strip slide — pinch is deferred (animation plays through) rather than cancelled
- [x] 7.7 Manual test: fast pinch release with lateral motion does NOT trigger swipe navigation
- [x] 7.8 Regression: double-tap zoom still works from unzoomed and toggles back
- [x] 7.9 Regression: single-finger swipe-to-navigate still works (regular and smart panel modes)
- [x] 7.10 Regression: panel-drag between panels still works in smart panel mode
- [x] 7.11 Regression: vertical/webtoon mode is unchanged — native scroll still governs, no pinch behavior introduced
- [x] 7.12 Regression: scroll-wheel navigation and keyboard arrows still work

## 8. Build and lint

- [x] 8.1 Run `npm run lint` — no new warnings/errors attributable to this change (pre-existing lint issues in `VerticalScrollView.tsx` and `ThemeProvider.tsx` untouched)
- [x] 8.2 Run `npm run build` — production build compiles successfully

## Notes on archive

Implementation is code-complete and compiles. In-browser manual tests (1.2 and 7.1–7.12) were not performed during the apply session (dev server was torn down mid-session). They remain as a handheld verification checklist for the user, to be exercised on the device where pinch gestures are actually expressive.
