## Why

Cross-page panel transitions in Smart Panel Zoom have two visible defects:

1. **The Focus Mode letterbox "jumps" during the slide.** `slideToZoomedPage` drives the carousel strip with a CSS `transition: transform 250ms ease-out`, but drives the letterbox morph with a hand-rolled rAF loop using `eased = 1 - (1-t)^3` (cubic ease-out). CSS `ease-out` is `cubic-bezier(0, 0, 0.58, 1)`, not cubic — at the midpoint of the slide the bars are ~19% of the slide distance ahead of the strip. They visibly race forward of the panel and then settle.

2. **Touch cross-page drag starts from a stale transform.** `smart-panel-zoom`'s spec requires that "swipe after pinch interpolates from the live pinched transform (not the pristine panel transform)." The within-page touch path honors this by reading live refs at gesture end. The cross-page touch commit/cancel paths (`handleTouchEnd` cross-page branches) instead pass `fromTransform: drag.start` — the snapshot from `handleTouchStart`, taken before any pinch the user did mid-gesture. A pinch-then-drag across a page boundary morphs from the wrong place, which the user perceives as the destination zoom landing in the wrong position/amount even though the endpoint math is correct.

`slideToZoomedPage` (keyboard/wheel/tap path) already reads live refs for `fromTransform`, so the second bug only affects touch cross-page commits and cancels.

## What Changes

- Replace the rAF-driven letterbox morph in `slideToZoomedPage` with a CSS transition on the bar geometry of the same `250ms ease-out` curve as the strip slide. One write at the start (target rect), the browser interpolates with the strip-matching curve, no per-frame loop, no cancellation generation, no curve drift.
- Update the touch cross-page commit branch in `handleTouchEnd` and the touch cross-page cancel branch to read `fromTransform` from live `zoomOriginRef`/`zoomScaleRef`/`panRef` instead of `drag.start` — matching `slideToZoomedPage`'s pattern.
- Update the in-flight cross-page morph in `handleTouchMove` to do the same, so a pinch performed mid-drag flows continuously into the cross-page lerp.
- Validate (and only fix if confirmed) the post-commit one-frame settle: after the final morph write at `progress=1`, the next `applyZoomTransform` from the live refs should produce the same projected rect on the now-copied dest canvas. If the rects differ from rounding/timing, defer `letterboxFadingRef = false` until *after* the post-commit `applyZoomTransform` writes, so there is no visible second update.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `focus-mode`: Tighten the cross-page letterbox morph requirement so the bar geometry transition uses the same duration and easing curve as the strip's transform transition (eliminating the visible lead/lag).
- `smart-panel-zoom`: Extend the "swipe after pinch interpolates from the live pinched transform" requirement to apply to cross-page swipes (touch commit/cancel and in-progress drag), not only within-page swipes.

## Impact

- `src/components/Reader/MangaReader.tsx`: replace the `stepMorph` rAF loop in `slideToZoomedPage` (~lines 1770–1793) with a single styled `writeLetterbox` call backed by a CSS bar transition matching the strip's `250ms ease-out`. Update three cross-page `dragInterp` construction sites in `handleTouchMove` and `handleTouchEnd` (~lines 2387, 2389–2396, 2704–2710) to read live refs instead of `drag.start`. Possibly add a one-frame deferral of the `letterboxFadingRef = false` clear in `commitNeighborSlide`'s post-commit rAF (line 1711–1714) if validation shows a settle.
- No API, schema, persistence, or dependency changes.
- Performance: removes one rAF loop per cross-page slide; no new work.
