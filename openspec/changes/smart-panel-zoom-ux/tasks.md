## 1. Panel Hit-Testing

- [x] 1.1 Add `hitTestPanel(tapX: number, tapY: number): { panel: Panel, index: number } | null` helper that converts screen coordinates to normalized page coordinates (0-1) using the canvas bounding rect, then checks if the point falls within any panel's bounding box (with 15% margin expansion). Returns the first matching panel and its index, or null.

## 2. Double-Tap Panel Entry/Exit

- [x] 2.1 Modify the double-tap branch in `handleTouchEnd`: when `smartPanelZoom && hasPanelData` and NOT currently zoomed, call `hitTestPanel` — if a panel is matched, call `zoomToPanel(panel)` and set `currentPanelIndex`/`currentPanelIndexRef` to the matched index; if no panel matched, do nothing (skip both `enterZoom` and `exitZoom`)
- [x] 2.2 Modify the double-tap branch when already zoomed in panel mode: call `exitZoom(true)`, reset `currentPanelIndex` to -1

## 3. Retreat Panel (Backward Navigation)

- [x] 3.1 Add `retreatPanel(): boolean` function that decrements `currentPanelIndex` and calls `zoomToPanel` on the previous panel. Returns true if handled.
- [x] 3.2 Handle cross-page backward transition in `retreatPanel`: when at first panel (index 0), pre-render previous page (`currentPage - 1`) on the appropriate carousel slot (prev slot for LTR, next slot for RTL) at hi-res zoomed to its last panel, slide the strip in the opposite direction of `advancePanel`, and on `transitionend` copy canvas state to current slot and update page/panel state
- [x] 3.3 Handle edge case: when at first panel of first page in volume, exit zoom and return false (fall through to normal behavior)

## 4. Swipe Gesture Routing

- [x] 4.1 In `handleTouchEnd`, when `smartPanelZoom && hasPanelData` and the gesture is a swipe (not a tap): determine swipe direction relative to reading direction (`effectiveDirection`). Swipe in reading direction = "forward", against = "backward"
- [x] 4.2 When zoomed into a panel and swipe forward: call `advancePanel()`. If it returns false (end of volume), fall through to normal behavior
- [x] 4.3 When zoomed into a panel and swipe backward: call `retreatPanel()`. If it returns false (start of volume), fall through to normal behavior
- [x] 4.4 When NOT zoomed (full page view) and swipe forward: call `advancePanel()` to enter first panel (index starts at -1, so advancing goes to 0)
- [x] 4.5 When NOT zoomed (full page view) and swipe backward: fall through to normal carousel page navigation

## 5. Single Tap Simplification

- [x] 5.1 In `handleTouchEnd` single-tap handler: when `smartPanelZoom && hasPanelData`, replace the `advancePanel()` call with `setBarsVisible(v => !v)` (toolbar toggle only)

## 6. Verification

- [ ] 6.1 Manually test: double-tap on a panel zooms into that specific panel
- [ ] 6.2 Manually test: double-tap on gutter/margin area does nothing
- [ ] 6.3 Manually test: double-tap while zoomed exits to full page view
- [ ] 6.4 Manually test: swipe forward navigates to next panel with animation
- [ ] 6.5 Manually test: swipe backward navigates to previous panel with animation
- [ ] 6.6 Manually test: swipe forward past last panel transitions to next page first panel
- [ ] 6.7 Manually test: swipe backward past first panel transitions to previous page last panel
- [ ] 6.8 Manually test: swipe forward on full page view enters first panel
- [ ] 6.9 Manually test: swipe backward on full page view turns page normally
- [ ] 6.10 Manually test: single tap toggles toolbar in panel mode (does not advance)
- [ ] 6.11 Manually test: RTL reading direction swaps swipe directions correctly
- [ ] 6.12 Manually test: desktop click-to-advance still works
- [x] 6.13 Run `npm run build` to confirm no TypeScript errors
