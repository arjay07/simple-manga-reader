## Context

The manga reader has smart panel zoom implemented with a tap-to-advance model: single tap zooms to the next panel sequentially, with cross-page transitions when advancing past the last panel. Double-tap performs a generic 2.5x point zoom unrelated to panels. Touch handling lives in `MangaReader.tsx` via `handleTouchStart/Move/End` with carousel swipe for page turns and a 280ms tap delay for double-tap detection.

Key existing functions:
- `advancePanel()` — zooms to next panel, handles cross-page transition via carousel strip animation
- `zoomToPanel(panel)` — re-renders canvas at hi-res and applies CSS transform to center on a panel
- `enterZoom(tapX, tapY)` — generic 2.5x point zoom
- `exitZoom()` — resets zoom state to 1x
- `detectDoubleTap()` — checks if two taps are within 280ms/40px

Panel data is stored as normalized coordinates (0-1 range) per page, with `pageType` distinguishing panels vs full-bleed/cover pages.

## Goals / Non-Goals

**Goals:**
- Replace tap-to-advance with swipe-based panel navigation (next and previous)
- Double-tap on a panel enters panel zoom by hit-testing against panel bounding boxes
- Double-tap while zoomed exits to full page view
- Swipe in reading direction from full page view enters first panel
- Bidirectional cross-page panel transitions (next page first panel, previous page last panel)
- RTL/LTR-aware swipe directions consistent with existing carousel behavior

**Non-Goals:**
- Pinch-to-zoom or variable zoom levels
- Vertical scroll mode panel navigation
- Spread mode panel navigation
- Changing how panel data is fetched or stored
- Mouse/desktop gesture changes (click still advances panel for desktop)

## Decisions

### Panel hit-testing for double-tap entry

On double-tap, convert the tap point to normalized page coordinates (0-1 range) using the canvas bounding rect, then check if the point falls within any panel's bounding box (with the same 15% margin used by `zoomToPanel`). If a match is found, call `zoomToPanel(matchedPanel)` and set `currentPanelIndex` to the matched panel's index.

**Why not nearest-panel?** The user explicitly wants "do nothing" on non-panel taps — this keeps the interaction predictable and avoids accidental zoom when tapping gutters or margins.

**Implementation:** A `hitTestPanel(tapX, tapY): { panel: Panel, index: number } | null` helper that iterates the current page's panels and returns the first match containing the normalized point.

### Swipe replaces tap for panel navigation in touch mode

In `handleTouchEnd`, when smart panel zoom is active:
- **Swipe in reading direction** (determined by `effectiveDirection`): call `advancePanel()` or new `retreatPanel()`
- **Swipe against reading direction**: call `retreatPanel()` or `advancePanel()`
- Reuse the existing carousel swipe threshold logic (velocity > 0.3 px/ms or distance > 30% viewport)

The swipe detection already exists in the carousel code — the change is routing swipes to panel functions instead of `animateStrip` when in panel mode.

**When not zoomed into a panel:** Swipe in reading direction enters the first panel (calls `advancePanel()` from index -1). Swipe against reading direction does normal page navigation.

**When zoomed:** All swipes go to panel navigation. Panning is removed in panel zoom mode since `zoomToPanel` precisely fits the panel in the viewport with padding — there's nothing useful to pan to.

### `retreatPanel()` mirrors `advancePanel()`

New function that decrements `currentPanelIndex` and calls `zoomToPanel`. Cross-page behavior:
- At first panel (index 0), go to previous page's last panel
- Pre-render previous page on the prev carousel slot (or next slot for RTL) at hi-res zoomed to its last panel
- Slide the strip in the opposite direction of `advancePanel`
- On `transitionend`, copy canvas state to current slot and update page/panel state

This is structurally identical to `advancePanel`'s cross-page logic but with `prevCanvasRef`/`prevZoomWrapperRef` as target (or `nextCanvasRef` for RTL) and using `currentPage - 1`.

### Single tap always toggles toolbar

Remove `advancePanel()` from the single-tap handler in panel mode. The 280ms delay is still needed for double-tap detection (double-tap now enters/exits panel zoom). Single tap simply calls `setBarsVisible(v => !v)`.

### Desktop click behavior unchanged

`handleContainerClick` still calls `advancePanel()` on click when smart panel zoom is active. This provides a simple click-to-advance on desktop while mobile gets the richer swipe/double-tap model. A future enhancement could add keyboard arrow keys for desktop panel navigation.

## Risks / Trade-offs

- **280ms tap delay remains** — Still needed for double-tap detection in panel mode. Could be removed if we made double-tap only work from full-page view, but that would prevent double-tap-to-exit while zoomed. Acceptable cost.
- **No pan while panel-zoomed** — Panel zoom fits the panel precisely, so panning shouldn't be needed. If panels are very large and the zoom crops important content, this could be a problem. Mitigation: the 15% margin padding on panel bounds should handle overflow dialogue bubbles.
- **`retreatPanel` cross-page complexity** — Mirrors ~80 lines of async canvas pre-rendering from `advancePanel`. Risk of subtle divergence. Mitigation: both functions share the same pattern; consider extracting shared helpers if duplication becomes a maintenance burden.
- **Swipe direction in full-page view is asymmetric** — Swipe-forward enters first panel, swipe-back turns page. This could be confusing initially. Mitigation: it's the most natural flow — you enter panels going forward, go back if you overshot.

## Open Questions

- Should there be a visual indicator (e.g., panel highlight border) when double-tapping to show which panel was detected? (Not planned for this change — keep it minimal.)
