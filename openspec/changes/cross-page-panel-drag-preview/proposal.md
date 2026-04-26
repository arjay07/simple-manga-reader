## Why

In Smart Panel Zoom on touch devices, dragging from the last panel of a page to the first panel of the next page (or vice versa in reverse) only rubber-bands the current panel — there is no live preview of the next page following the finger. The page transition only happens after the gesture is released, which feels disconnected compared to within-page panel drags where the next panel tracks the finger in real time. Focus Mode's letterbox bars also fade out entirely during this cross-page slide instead of morphing between the from-panel and to-panel rects the way within-page drags do.

## What Changes

- Pre-render the neighboring page (next or previous) into the carousel's prev/next slot whenever the user is zoomed onto a boundary panel (first or last panel of the current page), so a cross-page drag can begin instantly.
- Extend the touch panel-drag handlers so that when crossing a page boundary with a ready neighbor, the carousel strip translates with the finger and the neighbor's pre-computed panel transform is applied to its slot — giving the user the same "panel follows finger" feel as within-page drags.
- Extend Focus Mode's letterbox morph (`writeLetterbox` `dragInterp`) to support a cross-page mode that lerps between the from-panel rect (on the current page) and the to-panel rect (on the neighbor page), accounting for the strip's translation each frame so the bars track the panel coming into view.
- On gesture release, commit by finishing the strip slide and reusing the existing slot-handoff cleanup (factored out of `slideToZoomedPage`) — or spring the strip and letterbox back to the start panel on cancel.
- Preserve today's rubber-band + post-release slide as a fallback when the neighbor page hasn't finished pre-rendering yet.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `smart-panel-zoom`: Adds a requirement for live cross-page panel drag preview on touch — neighbor page pre-render, strip-following-finger during drag, commit/cancel on release with fallback to the existing rubber-band path.
- `focus-mode`: Extends the letterbox drag-morph requirement to cover cross-page panel transitions, so the bars interpolate between the from-panel and to-panel rects through the strip translation rather than fading out.

## Impact

- `src/components/Reader/MangaReader.tsx`: new neighbor pre-render effect, new cross-page state on `panelDragRef`, changes to `handleTouchStart`/`handleTouchMove`/`handleTouchEnd` cross-page branches, refactor of `slideToZoomedPage`'s slot-handoff cleanup into a reusable helper, extension of `writeLetterbox` to handle a cross-page `dragInterp` shape.
- No API, schema, or persistence changes. No new dependencies.
- Performance: pre-rendering one neighbor page while zoomed at a boundary panel adds one extra PDF render pass per boundary entry. Already paid for on commit by `slideToZoomedPage`; this change just moves the cost earlier.
