## 1. Refactor existing slot/slide logic for reuse

- [x] 1.1 Extract a `pickSlot(readingDir)` helper from `slideToZoomedPage` (lines 1353–1359) returning `{ slot, targetCanvas, targetWrapper, targetRenderTaskRef, slideTarget }`.
- [x] 1.2 Extract `slideToZoomedPage`'s `onSlideEnd` cleanup into a reusable `commitNeighborSlide({ targetPageNum, targetPanelIndex, resolvedStopIndex, transform, slot })` helper that performs the canvas copy, strip snap-back, zoom-ref sync, page change, and rAF re-apply.
- [x] 1.3 Extract the neighbor-page render + transform compute portion of `slideToZoomedPage` into `prerenderNeighbor(targetPageNum, targetPanel, targetStopIndex, slot)` returning `{ transform, panelIndex, resolvedStopIndex }` and writing the canvas/wrapper transform into the chosen slot.
- [x] 1.4 Verify `slideToZoomedPage` still works with the extracted helpers (manual smoke test: tap-to-advance across page boundary while zoomed in panel mode). _(requires human verification on touch device)_

## 2. Pre-render neighbor page on boundary panel

- [x] 2.1 Add `crossPageReadyRef` ref of shape `{ forward: CrossPageTarget | null, backward: CrossPageTarget | null }`.
- [x] 2.2 Add `useEffect` keyed on `(currentPage, currentPanelIndex, panelStopRef.current via state mirror, isZoomed, smartPanelZoom, hasPanelData, panelDataMap, pdfDocument)` that:
  - When zoomed on the last panel of `currentPage` and a next page with panel data exists, call `prerenderNeighbor(nextPageNum, firstPanel, 0, pickSlot('forward').slot)` and store the result in `crossPageReadyRef.current.forward`.
  - When zoomed on the first panel/stop 0 of `currentPage` and a previous page with panel data exists, call `prerenderNeighbor(prevPageNum, lastPanel, -1, pickSlot('back').slot)` and store the result in `crossPageReadyRef.current.backward`.
  - Otherwise clear the appropriate refs and reset the corresponding neighbor wrapper transform to `none`.
- [x] 2.3 Cancel any in-flight `prerenderNeighbor` task when the effect re-runs or unmounts.

## 3. Wire cross-page target into panel drag state

- [x] 3.1 Extend `panelDragRef`'s shape with optional `crossPageForward` / `crossPageBackward: CrossPageTarget | null`.
- [x] 3.2 In `handleTouchStart`, when within-page `forwardTarget` is null and `crossPageReadyRef.current.forward` is set and the boundary condition still holds, copy it onto `panelDragRef.current.crossPageForward`. Mirror for backward.
- [x] 3.3 Ensure pinch start (`handleTouchStart` line 1768–1774) also clears any neighbor strip translation set by an interrupted cross-page drag (reset strip transform to `-100vw` with `transition: none`).

## 4. Cross-page drag preview in `handleTouchMove`

- [x] 4.1 In the smart-panel zoomed branch (lines 1903–1939), after the within-page forward/backward target check, add a cross-page branch: when the relevant `crossPageForward`/`crossPageBackward` is set and the drag direction matches.
- [x] 4.2 Compute drag progress as `clamp(|adjustedDx| / window.innerWidth, 0, 1)`.
- [x] 4.3 Compute the strip translateX as a lerp from `-100vw` (progress 0) to the slot's slide target (`0` for prev, `-200vw` for next), set `strip.style.transition = 'none'` and apply the transform.
- [x] 4.4 Leave the current page's wrapper at its drag-start transform (do NOT call `applyInterpolatedTransform` for cross-page).
- [x] 4.5 Call `writeLetterbox` with the new cross-page `dragInterp` (see task 5).

## 5. Extend `writeLetterbox` for cross-page morph

- [x] 5.1 Extend the `dragInterp` parameter type to support a cross-page variant: `{ kind: 'cross-page', fromPanel, fromTransform, toPanel, toTransform, slot, stripTranslateX, progress }`.
- [x] 5.2 In `writeLetterbox`, branch on `dragInterp.kind`:
  - **Within-page** (existing behavior, unchanged): two-rect lerp on the current canvas.
  - **Cross-page**: project `fromPanel` through `fromTransform` on the current canvas; project `toPanel` through `toTransform` on the neighbor canvas (use neighbor canvas dimensions). Offset `fromRect.x` by `stripTranslateX + 100vw` and `toRect.x` by `(slot === 'prev' ? 0 : -200vw) + stripTranslateX + 100vw`. Lerp the two viewport-space rects by `progress`.
- [x] 5.3 Do not fade the letterbox during cross-page drag (set `fadeOpacity = 1`).

## 6. Commit / cancel in `handleTouchEnd`

- [x] 6.1 In the smart-panel zoomed branch (lines 2117–2157), before the existing commit/cancel logic, detect cross-page drag (`drag.crossPageForward` or `drag.crossPageBackward` is set and was active).
- [x] 6.2 For cross-page commit (threshold or fast-flick): animate the strip from current translateX to the slot's full slide target with `transition: transform <durationRemaining>ms ease-out` (durationRemaining = `250 * (1 - progress)`), then on `transitionend` call `commitNeighborSlide(crossPageTarget)`.
- [x] 6.3 For cross-page cancel (below threshold and below flick velocity): animate the strip from current translateX back to `-100vw` with the same proportional transition, and synchronously transition the letterbox bars back to the from-rect (no fade). On transitionend, leave the neighbor wrapper transform in place (still valid for next gesture).
- [x] 6.4 Skip the existing rubber-band restore-and-snap-back path when a cross-page commit/cancel was issued.
- [x] 6.5 Vertical-swipe and tap fast-paths must still take precedence over the cross-page branch (preserve existing ordering).

## 7. Fallback path

- [x] 7.1 When no cross-page target is ready (neighbor page has no panel data, or pre-render hasn't resolved), let `handleTouchMove` fall through to today's rubber-band branch (lines 1916–1921).
- [x] 7.2 On commit, today's path (`navigateReading` → `advancePanel`/`retreatPanel` → `slideToZoomedPage`) continues to work unchanged because step 1 only refactored helpers, not the public function shape.

## 8. Cleanup and regression checks

- [x] 8.1 Reset both neighbor wrapper transforms to `none` in the `navigateReading` neighbor-reset block (lines 1701–1706) and after any non-cross-page page change to avoid stale neighbor state surfacing in `animateStrip`.
- [x] 8.2 `npm run build` and `npm run lint` pass.
- [x] 8.3 Manual smoke on touch device (or device-emulated touch in DevTools): within-page panel drag still works, cross-page drag previews live, commit lands on neighbor's first/last panel, cancel springs back, fallback engages when neighbor not pre-rendered, letterbox morphs continuously without fade-out across the cross-page slide, RTL and LTR both behave correctly, vertical swipe still navigates by page. _(requires human verification on touch device)_
- [x] 8.4 Verify keyboard arrow, mouse wheel, tap-to-turn, and arrow buttons still trigger `slideToZoomedPage` (not the new live-drag path) and behave identically to today. _(requires human verification)_
