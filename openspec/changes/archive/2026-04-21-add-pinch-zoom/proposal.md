## Why

Users instinctively pinch to zoom on touch devices, but the reader currently only supports zoom via double-tap. Users — including those in smart panel mode, where automated zoom is already doing a lot of work for them — are regularly observed trying to pinch and getting no response, which reads as a broken interface. Adding pinch completes the expected touch-device gesture set with minimal change to existing flows.

## What Changes

- Add two-finger pinch-to-zoom in paginated reader mode (regular and smart panel), driving the existing zoom state machine (`zoomScaleRef`, `zoomOriginRef`, `panRef`, `applyZoomTransform`).
- Pinch entry works from the unzoomed page view and while already zoomed, adjusting scale continuously.
- While pinching, two-finger midpoint translation pans the zoomed content (so pinching and panning happen in one gesture).
- In smart panel mode, pinch-in adjusts zoom freely without pausing panel mode — swipes after pinch continue to advance panel-by-panel. Only when the user pinches all the way out (below the fit threshold) does the reader pause panel auto-zoom, matching the double-tap-out escape gesture.
- Scale is clamped to the range `[fit, 5×]`. On pinch end, if scale has dropped below fit, the reader exits zoom back to the full page view.
- On pinch end above the fit threshold, the reader triggers the existing hi-res canvas re-render (same code path as double-tap zoom / panel zoom) so the final view is sharp.
- Vertical/webtoon mode and spread mode are explicitly out of scope for this change. Vertical requires native-scroll interception; spread mode's `onTouchMove` isn't wired today and would require a separate pass. Both will be addressed in follow-up changes.
- Ensure the viewport `<meta>` tag suppresses native iOS Safari page-level pinch so our handler has exclusive control.

## Capabilities

### New Capabilities
- `pinch-zoom`: Two-finger pinch-to-zoom gesture in the paginated reader, including pinch-in, pinch-out, two-finger pan, and scale clamping.

### Modified Capabilities
- `smart-panel-zoom`: Pinching while parked on a computed panel view pauses panel-by-panel navigation, matching the existing double-tap-out behavior.

## Impact

- **Code**: Primarily `src/components/Reader/MangaReader.tsx` — `handleTouchStart`, `handleTouchMove`, `handleTouchEnd`, plus a new `pinchStateRef` and helpers. Small change to `src/app/layout.tsx` (viewport meta) if needed.
- **APIs**: None.
- **Dependencies**: None — uses native `TouchEvent`.
- **Risk surface**: Touch-handler coexistence with the existing swipe-to-navigate, panel-drag, and single-finger zoom-pan paths. The gating rule is "if `touches.length === 2` route to pinch, else existing logic" — but the transition between 2→1 finger mid-gesture needs to preserve the zoomed state cleanly.
