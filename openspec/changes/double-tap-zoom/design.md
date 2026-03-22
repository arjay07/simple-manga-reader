## Context

The manga reader renders PDF pages onto `<canvas>` elements inside a three-slot carousel strip (`prev | current | next`). Carousel navigation uses CSS `translateX` on the strip div. Touch events are handled centrally in `MangaReader.tsx` via `onTouchStart/Move/End`. There is currently no zoom state and no double-tap detection.

The feature targets **single-page carousel mode only** (`!isVertical && !spreadMode`). Vertical and spread modes are unchanged.

## Goals / Non-Goals

**Goals:**
- Detect double-tap (two taps within ~280ms, within ~40px of each other)
- Zoom 2.5× centered on the tap point using CSS transform
- Pan while zoomed with one-finger drag, clamped to page bounds
- Double-tap again to zoom out
- Block carousel swipe navigation while zoomed
- Reset zoom on page change

**Non-Goals:**
- Pinch-to-zoom / variable zoom levels
- Vertical scroll mode zoom
- Spread mode zoom
- Re-rendering the canvas at higher resolution when zoomed (canvas is already rendered at `devicePixelRatio`, which provides sufficient quality at 2.5×)

## Decisions

### CSS transform on canvas wrapper div

Apply zoom via CSS `transform: scale(s) translate(tx, ty)` on a wrapper `<div>` around the current-slot canvas, using `transform-origin` set to the tap point in canvas-local coordinates.

**Why not transform the strip?** The strip already uses `transform: translateX(...)` for carousel animation. Compositing zoom onto the strip would require combining two transforms and would complicate the animation/reset logic.

**Why not re-render at higher scale?** Re-rendering takes time and would cause a flash. The canvas is already rendered at `devicePixelRatio` (typically 2–3×), so CSS scaling to 2.5× remains sharp enough on most devices.

### Zoom state in refs (not React state) for pan

`panX/panY` and `zoomScale` are kept in refs for smooth panning (avoids re-renders on every touch move). A single `isZoomed` boolean in React state drives the conditional rendering/behavior fork.

### 280ms single-tap delay via `setTimeout`

On `touchend`, schedule tap-to-turn and toolbar-toggle actions in a `setTimeout(fn, 280)`. If a second tap arrives within that window, cancel the timer and handle as double-tap instead.

**Trade-off:** Every single tap in paginated mode feels ~280ms less snappy. This is the standard approach (used by Tachiyomi, etc.) and is imperceptible to most users in practice — but it is a real cost.

**Alternative considered:** Restrict double-tap to the center zone only (where single-tap doesn't turn pages anyway). Rejected because it would limit zoom entry to a narrow strip and feel unintuitive.

### Pan clamping

While zoomed, restrict `panX/panY` so the canvas edge cannot move past the container edge. Bounds computed as:

```
maxPanX = max(0, (canvasDisplayWidth  * zoom - containerWidth)  / 2)
maxPanY = max(0, (canvasDisplayHeight * zoom - containerHeight) / 2)
```

Pan is clamped to `[-maxPanX, maxPanX]` and `[-maxPanY, maxPanY]`.

### Zoom resets on page change

`useEffect` watching `currentPage` resets `isZoomed`, `panX`, `panY`, and the CSS transform. This prevents stale zoom state when navigating volumes or jumping via the scrub bar.

## Risks / Trade-offs

- **280ms tap delay** → Slightly less snappy page turns. Mitigation: only applies in paginated mode; delay is below perceptual threshold for most users.
- **Canvas sharpness at 2.5×** → On 1× DPR displays (rare desktop), the canvas is only 1× resolution, so 2.5× zoom will look pixelated. Mitigation: acceptable trade-off for the scope; re-render on zoom is a future enhancement.
- **Touch event conflict while panning near strip edge** → If the user drags beyond pan bounds, the gesture is consumed (does not accidentally trigger carousel). Mitigation: block `animateStrip` when `isZoomed` is true.

## Open Questions

- Should zooming out (double-tap) animate smoothly or snap instantly? (Smooth transition preferred; use CSS `transition: transform 200ms ease-out` on zoom changes only.)
