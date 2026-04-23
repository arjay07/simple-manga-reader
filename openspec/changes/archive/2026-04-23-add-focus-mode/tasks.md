## 1. Toggle state & persistence

- [x] 1.1 Add `focusMode` state in `MangaReader.tsx` initialized from `localStorage.getItem('focusMode') === 'true'` (mirroring the `smartPanelZoom` pattern).
- [x] 1.2 Add `handleFocusModeChange(value: boolean)` that writes the boolean string back to `localStorage` and triggers an overlay refresh.
- [x] 1.3 Thread `focusMode` and `onFocusModeChange` props through to `ReaderSettingsModal`.

## 2. Settings modal UI

- [x] 2.1 Extend `ReaderSettingsModalProps` with `focusMode: boolean` and `onFocusModeChange: (value: boolean) => void`.
- [x] 2.2 Inside the existing `!isVertical` block, below the Smart Panel Zoom row, render the Focus Mode toggle wrapped in `{smartPanelZoom && ( ... )}` so it disappears entirely when SPZ is off.
- [x] 2.3 Style the new row to match the Smart Panel Zoom toggle; add a one-line helper below the label (e.g., `text-xs text-white/40`) explaining Focus Mode.

## 3. Overlay structure & refs

- [x] 3.1 Add four `useRef<HTMLDivElement>` for the top/bottom/left/right bars, a parent ref for the letterbox group (used for opacity fades), and render the group absolutely-positioned inside the reader container at a z-index above the strip but below the toolbar/bottom bar/back button/arrow buttons.
- [x] 3.2 Add `panelRectRef` (current padded rect in viewport coords) and `letterboxFadingRef` (set true during cross-page strip-slide).
- [x] 3.3 Add `pointer-events-none` to the overlay group so it never intercepts taps.

## 4. Rect projection helper

- [x] 4.1 Implement `updatePanelRect(panel, stopIndex?, transformOverride?)` that computes the padded rect in viewport coords using the same 8% adaptive margin as `computePanelTransform`, writing to `panelRectRef`.
- [x] 4.2 Implement `writeLetterbox({ withTransition, fadeOpacity? })` that reads `panelRectRef` + gating flags, applies `top/left/width/height` to the four edge refs, applies `opacity` + `transition` to the group, and sets the correct visibility.
- [x] 4.3 Add helper `shouldShowLetterbox()` that encodes the full gating rule: `focusMode && smartPanelZoom && hasPanelData && isZoomedRef.current && !panelZoomPausedRef.current && panelRectRef.current !== null`.

## 5. Integrate with zoom & gesture paths

- [x] 5.1 In `zoomToPanel` (after the final transform is written), call `updatePanelRect(panel, stopIndex)` + `writeLetterbox({ withTransition: true })`.
- [x] 5.2 In `applyZoomTransform(withTransition)` (or its call sites on non-panel exits), call `writeLetterbox({ withTransition })`.
- [x] 5.3 In `applyInterpolatedTransform` (drag preview + pinch), call `updatePanelRect(currentPanel, currentStop, interpolatedTransform)` + `writeLetterbox({ withTransition: false })` on every frame.
- [x] 5.4 On pinch-out-to-pause and double-tap-out-to-pause paths, call `writeLetterbox({ fadeOpacity: 0 })` with a 150 ms opacity transition.
- [x] 5.5 On double-tap-in (re-enter panel mode after pause), call `writeLetterbox({ fadeOpacity: 1 })` after the zoom settles.

## 6. Cross-page transitions

- [x] 6.1 At the start of `slideToZoomedPage`, `advancePanel`'s cross-page branch, and `retreatPanel`'s cross-page branch, set `letterboxFadingRef = true` and fade the overlay to opacity 0 over ~150 ms.
- [x] 6.2 After the strip settles and the new page's `zoomToPanel` runs, clear `letterboxFadingRef`, update the rect for the new panel, and fade back to opacity 1.
- [x] 6.3 On `setCurrentPanelIndex(-1)` paths (paused, non-panel pages), fade out and ensure subsequent page changes stay hidden until the next zoom.

## 7. Resize & lifecycle

- [x] 7.1 Extend the existing viewport resize handling so that when the window is resized while letterbox is visible, `updatePanelRect` runs for the current panel/stop and `writeLetterbox({ withTransition: false })` re-applies.
- [x] 7.2 When Focus Mode is toggled on while already zoomed, call `updatePanelRect` + `writeLetterbox({ fadeOpacity: 1 })` so bars fade in immediately.
- [x] 7.3 When Focus Mode is toggled off, fade overlay to opacity 0 and leave DOM in place (no unmount flicker).

## 8. Verification

- [x] 8.1 Run `npm run lint` and `npm run build` and fix any errors surfaced.
- [x] 8.2 Manually verify (in `npm run dev`) each spec scenario: toggle visibility gating, default off, persistence, framing matches zoom padding, fade on enter/exit, pinch tracking, drag-preview tracking, cross-page fade, paused hides bars, full-bleed hides bars, resize realigns bars, toolbar/bottom bar remain clickable over the overlay.
- [x] 8.3 Validate the change bundle: `openspec validate add-focus-mode --strict`.
