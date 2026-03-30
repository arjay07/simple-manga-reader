## 1. Stop Computation

- [x] 1.1 Add `panelStopRef = useRef(0)` to track current stop index within the current panel
- [x] 1.2 Add `computeStopCount(panel: Panel): { stopCount: number; zoom: number }` helper that computes height-fit zoom, determines how many stops the panel needs at that zoom (ceil of panel-width-at-zoom / viewport-width * 0.85), caps at 3, and reduces zoom if capped. Returns 1 for narrow panels with the existing fitZoom.

## 2. Multi-Stop zoomToPanel

- [x] 2.1 Add `stopIndex` parameter (default 0) to `zoomToPanel(panel, stopIndex?)`. When `stopCount === 1`, behavior is unchanged (center panel). When `stopCount > 1`, use height-fit zoom and compute per-stop `panX` that shifts the viewport window horizontally across the panel with 15% overlap between stops.
- [x] 2.2 Handle RTL stop order: when `effectiveDirection === 'rtl'`, reverse the stop order so stop 0 shows the rightmost portion and subsequent stops pan leftward.

## 3. advancePanel Stop Integration

- [x] 3.1 At the top of `advancePanel`, before incrementing `currentPanelIndex`, check if the current panel has more stops (`panelStopRef.current < stopCount - 1`). If so, increment `panelStopRef`, call `zoomToPanel(panel, panelStopRef.current)`, and return true.
- [x] 3.2 When advancing to the next panel (or next page first panel), reset `panelStopRef.current = 0` so the new panel starts at stop 0.
- [x] 3.3 In the cross-page transition of `advancePanel`, compute stop count for the next page's first panel and pass `stopIndex: 0` to the pre-render zoom calculation.

## 4. retreatPanel Stop Integration

- [x] 4.1 At the top of `retreatPanel`, before decrementing `currentPanelIndex`, check if the current panel stop > 0. If so, decrement `panelStopRef`, call `zoomToPanel(panel, panelStopRef.current)`, and return true.
- [x] 4.2 When retreating to the previous panel, compute that panel's stop count and set `panelStopRef.current = stopCount - 1` so it enters at the last stop.
- [x] 4.3 In the cross-page transition of `retreatPanel`, compute stop count for the previous page's last panel and pass `stopIndex: stopCount - 1` to the pre-render zoom calculation.

## 5. Reset & Edge Cases

- [x] 5.1 Reset `panelStopRef.current = 0` when `currentPanelIndex` resets to -1 (page change, exit zoom, toggle off smart panel zoom)
- [x] 5.2 In `hitTestPanel` double-tap entry, always set `panelStopRef.current = 0` so wide panels enter at the first stop
- [x] 5.3 In desktop `handleContainerClick` advancePanel path, ensure stop advancement works the same way (click advances stop, then panel)

## 6. Verification

- [x] 6.1 Run `npm run build` to confirm no TypeScript errors
- [ ] 6.2 Manually test: wide panel splits into 2-3 stops on portrait device
- [ ] 6.3 Manually test: swipe forward steps through stops before next panel
- [ ] 6.4 Manually test: swipe backward steps through stops in reverse
- [ ] 6.5 Manually test: narrow panel unchanged (single stop, centered)
- [ ] 6.6 Manually test: RTL reverses stop order (rightmost first)
- [ ] 6.7 Manually test: cross-page forward enters next page first panel at stop 0
- [ ] 6.8 Manually test: cross-page backward enters prev page last panel at last stop
- [ ] 6.9 Manually test: double-tap on wide panel enters at first stop
