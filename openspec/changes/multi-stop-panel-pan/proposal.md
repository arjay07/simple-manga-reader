## Why

On portrait devices, wide panels (spanning most of the page width) barely zoom because fitting the entire panel in the viewport leaves little room to enlarge. This is the standard problem that Comixology's Guided View solved: instead of fitting the whole panel, zoom to fit the panel's height and pan horizontally across it in discrete stops. This makes text readable on wide panels without cropping or requiring manual pinch-to-zoom.

## What Changes

- **Wide panels split into multi-stop pan sequences**: When a panel's width at height-fit zoom exceeds the viewport width, it is divided into 2-3 horizontal stops. Each swipe pans to the next stop before advancing to the next panel.
- **Stop count capped at 3**: If height-fit zoom would require more than 3 stops, the zoom is reduced so the panel fits in exactly 3 stops.
- **Stops respect reading direction**: RTL manga starts at the rightmost stop and pans left; LTR starts at the leftmost stop and pans right.
- **Retreat navigates stops in reverse**: Swiping backward steps through stops in reverse order before moving to the previous panel.
- **Double-tap on a wide panel enters at first stop**: Always enters at the first stop in reading order regardless of tap position.
- **Cross-page transitions preserve stop awareness**: When advancing to the next page's first panel or retreating to the previous page's last panel, stop count and position are computed for the target panel.
- **Narrow panels unchanged**: Panels that fit within the viewport at their natural zoom continue to use the existing single-stop fit-panel behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `panel-zoom-gestures`: Swipe navigation now steps through horizontal pan stops within wide panels before advancing to the next panel
- `smart-panel-zoom`: Panel zoom computation changes from always-fit-panel to height-fit with multi-stop pan for wide panels

## Impact

- `src/components/Reader/MangaReader.tsx` — `zoomToPanel()` gains stop-aware zoom/pan calculation, `advancePanel()`/`retreatPanel()` gain stop tracking, new `panelStopRef`/`panelStopCountRef` refs, cross-page transition code updated
- No API changes, no database changes, no new dependencies
