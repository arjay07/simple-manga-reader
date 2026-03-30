## Context

The smart panel zoom feature zooms into individual panels for readability. Currently, `zoomToPanel()` always fits the entire panel within the viewport using `Math.min(scaleX, scaleY)`. On portrait devices, wide panels (spanning most of the page width) barely zoom because the viewport width is the constraining axis — the panel already fills the screen width at 1x.

The industry-standard solution (Comixology Guided View) zooms to fit the panel's height and pans horizontally across the width in discrete stops. This change adopts that pattern.

Key existing code:
- `zoomToPanel(panel)` — computes zoom scale and pan offset, re-renders canvas at hi-res, applies CSS transform
- `advancePanel()` / `retreatPanel()` — increment/decrement `currentPanelIndex`, handle cross-page transitions
- `panelStopRef` does not exist yet — stop tracking is new
- Adaptive margins already in place: `margin = dim * 0.15 * (1 - dim)`

## Goals / Non-Goals

**Goals:**
- Wide panels zoom to fit height and split into 2-3 horizontal pan stops
- Swipe advances through stops before moving to the next panel
- Stop count capped at 3; zoom reduced if more would be needed
- Stops respect RTL/LTR reading direction
- Cross-page transitions compute stops for the target panel
- Narrow panels (single stop) are completely unchanged

**Non-Goals:**
- Vertical multi-stop (for tall narrow panels on landscape devices) — not needed for manga
- User-configurable stop count or zoom level
- Continuous smooth pan (auto-scroll / Ken Burns) — users want discrete control
- Pinch-to-zoom integration

## Decisions

### Nested stop counter (Approach B) over flat stop list

Track stops with a `panelStopRef` (current stop index) and compute stop count on the fly, rather than pre-computing a flat list of all stops for the page.

**Why:** Less invasive. `currentPanelIndex` stays unchanged. `advancePanel`/`retreatPanel` just check if the current panel has more stops before advancing the panel index. No new data structures to sync when panel data changes.

**Alternative considered:** Pre-compute a flat `stops[]` array mapping each entry to `{ panelIndex, stopIndex, panX, zoom }`. Rejected because it requires recomputation on page change, viewport resize, and orientation change, and replaces the simple panel index with a new abstraction throughout.

### Stop computation: height-fit zoom, then divide width

```
heightZoom = (vH * 0.9) / (ph * ch)
fitZoom = min(scaleX, scaleY, 5)  // current behavior
panelWidthAtZoom = pw * cw * heightZoom
rawStops = ceil(panelWidthAtZoom / (vW * 0.85))

if rawStops <= 1: single stop, use fitZoom (unchanged)
if rawStops 2-3:  use heightZoom, split into rawStops
if rawStops > 3:  reduce zoom so panel fits in exactly 3 stops
                  zoom = (3 * vW * 0.85) / (pw * cw)
```

The 0.85 overlap factor means each stop shares ~15% of content with the adjacent stop, preserving context during pan. The 0.9 vertical padding keeps the panel from touching viewport edges.

### `zoomToPanel` gains a `stopIndex` parameter

When `stopCount > 1`, `zoomToPanel(panel, stopIndex)` computes a per-stop `panX` that shifts the viewport window horizontally across the panel:

```
For stop i of N stops:
  stripWidth = pw * cw * zoom
  viewportStride = vW * 0.85  // each stop advances by this much
  totalStripWidth = (N - 1) * viewportStride + vW
  // leftmost position: panel left edge aligned with viewport left
  panX_base = (viewport center) - (panel left edge in canvas coords) * zoom
  // shift for stop i:
  panX = panX_base - i * viewportStride

RTL: reverse stop order (stop 0 = rightmost, stop N-1 = leftmost)
```

When `stopCount === 1`, behavior is identical to current (center the panel).

### Stop state in refs

- `panelStopRef = useRef(0)` — current stop index within the current panel
- Stop count is computed on the fly by a `computeStopCount(panel)` helper — no need to store it since it's derived from panel dimensions and viewport size.

### Cross-page transitions

When `advancePanel` transitions to the next page's first panel, it computes the stop count for that panel and starts at stop 0. When `retreatPanel` transitions to the previous page's last panel, it starts at the last stop (stopCount - 1). The pre-render logic on the carousel target slot uses the same `zoomToPanel` math with the appropriate stop index.

## Risks / Trade-offs

- **Stop boundaries feel arbitrary** — The 15% overlap is a heuristic. If speech bubbles happen to land exactly at a stop boundary, important text could be split across two stops. Mitigation: the overlap ensures ~15% of shared content at each boundary; this matches Comixology's approach.
- **Zoom reduction for 3-stop cap** — Very thin, very wide panels (e.g., a single horizontal strip) will have their zoom reduced to fit 3 stops, meaning they won't be at full height-fit. Mitigation: these are rare in manga; the 3-stop cap prevents tedious navigation while still providing meaningful zoom.
- **`computeStopCount` called multiple times** — It's called in `advancePanel`, `retreatPanel`, and `zoomToPanel`. It's a cheap arithmetic function (no DOM access beyond reading cached canvas dimensions), so performance is not a concern.
