## Context

Smart Panel Zoom (see `openspec/specs/smart-panel-zoom/spec.md`) scales and pans the page canvas so a single detected panel fills the viewport. Because the canvas is the entire PDF page, adjacent panels and page gutters remain visible at the viewport edges — especially on pages with tall panel layouts or on wide viewports where the fit-to-height panel leaves horizontal empty space around itself.

The existing zoom pipeline lives in `src/components/Reader/MangaReader.tsx` and is built around imperative refs (`zoomScaleRef`, `panRef`, `zoomOriginRef`) applied to a `zoomWrapperRef` via `applyZoomTransform` / `applyInterpolatedTransform`. Pinch gestures mutate these refs in real time; panel advances re-compute a stop transform via `computePanelTransform` / `zoomToPanel`; cross-page transitions animate the carousel strip and then swap in a pre-rendered zoomed canvas.

Focus Mode layers a visual-only overlay on top of this pipeline. No existing zoom math is touched — the overlay reads the same source-of-truth refs and projects the padded panel rect into viewport coordinates.

## Goals / Non-Goals

**Goals:**

- Provide a toggleable "Focus Mode" that hides everything outside the current panel's padded bounding box behind animated black bars.
- Integrate cleanly with all existing zoom paths: initial auto-zoom, tap-to-advance, drag-to-preview between panels, pinch-in/out, double-tap-in/out, cross-page strip-slide.
- Keep rendering performant: no per-frame React re-renders during gestures.
- Degrade gracefully on pages without panel data (`full-bleed`, `cover`, `blank`, or pages missing from `panelDataMap`).

**Non-Goals:**

- Non-rectangular / irregular panel masking (SVG clip-paths that follow jagged panel borders). Out of scope — bars are axis-aligned rectangles framing the padded bbox.
- Configurable crop tightness. The letterbox uses the same 8% adaptive margin as `computePanelTransform`; no user-facing slider.
- Focus Mode behavior in vertical reading mode. Vertical mode does not use Smart Panel Zoom, so Focus Mode is implicitly disabled there (same gating as the SPZ toggle).
- Per-profile persistence. Like `smartPanelZoom`, the preference lives in global `localStorage`, not in the profile record.

## Decisions

### 1. Overlay structure: four absolutely-positioned divs

Render four sibling divs inside the reader container (top / bottom / left / right), each `bg-black` and positioned via inline `top/left/width/height`. The top and bottom bars span the full viewport width; the left and right bars span only the vertical extent of the panel rect so the corners are covered exactly once.

Rejected alternatives:

- **Single div with `clip-path: polygon(...)`**: harder to animate smoothly across arbitrary rect changes, poorer GPU compositing on some browsers.
- **Single div with `box-shadow` cutout**: elegant but harder to coordinate opacity transitions and harder to reason about during pinch.

Four divs let each edge animate independently via direct DOM writes on refs, and let the whole group fade via a single `opacity` on a wrapper.

### 2. Rect derivation: live projection from existing transform refs

On every update to `panRef` / `zoomScaleRef` / `zoomOriginRef` (and during interpolated pinch/drag), compute the padded panel rect in viewport coordinates and write it straight to the four edge divs. The formula mirrors what `computePanelTransform` uses internally:

```
natLeft      = (vW - canvasCssWidth)  / 2
natTop       = (vH - canvasCssHeight) / 2
tx           = zoomOriginX * (1 - scale) + panX
ty           = zoomOriginY * (1 - scale) + panY
screenLeft   = natLeft + tx + (panel.x  - marginX) * canvasCssWidth  * scale
screenTop    = natTop  + ty + (panel.y  - marginY) * canvasCssHeight * scale
screenRight  = screenLeft + (panel.width  + 2*marginX) * canvasCssWidth  * scale
screenBottom = screenTop  + (panel.height + 2*marginY) * canvasCssHeight * scale
```

`marginX` / `marginY` reuse the exact 8% adaptive-margin formula from `computePanelTransform` so the letterbox and the zoom see the same rect.

Rejected alternative — **reading `wrapper.getBoundingClientRect()` + panel ratios**: simpler to write but forces a synchronous layout read each gesture frame and couples the overlay to DOM reflow timing. The pure-math projection above is cheaper and stays consistent with the values the zoom code already computes.

### 3. Single source of truth: `panelRectRef` + `letterboxVisibleRef`

Add two new refs in `MangaReader`:

- `panelRectRef: { left, top, right, bottom } | null` — current padded panel rect in viewport coords. Updated by a new helper `updatePanelRect(panel, stopIndex, transformOverride?)` that wraps the projection formula.
- `letterboxVisibleRef: boolean` — whether bars should be shown at all (gated by `focusMode && smartPanelZoom && isZoomedRef && !panelZoomPausedRef && panelRectRef !== null`).

A `writeLetterbox()` helper reads both refs and applies `top/left/width/height/opacity` to the four div refs with `transition` toggled based on context (200 ms ease-out during `applyZoomTransform(true)`; `none` during `applyInterpolatedTransform` and pinch).

### 4. Gesture integration points

- **`zoomToPanel` / `applyZoomTransform(withTransition=true)`**: call `updatePanelRect` + `writeLetterbox()` with a 200 ms transition so bars animate to the new rect alongside the wrapper.
- **`applyInterpolatedTransform` (drag / pinch)**: call `writeLetterbox()` with `transition: none` on every frame so bars follow 1:1.
- **Pinch-out past fit threshold**: `panelZoomPausedRef = true` → `writeLetterbox()` fades opacity to 0 (150 ms).
- **Double-tap to exit / double-tap-in to re-enter**: fade out / fade in, same 150 ms transition.
- **Cross-page strip-slide (`slideToZoomedPage` / `advancePanel` / `retreatPanel`)**: set a transient `letterboxFadingRef = true` at animation start → `writeLetterbox()` fades to 0. After the strip settles and the new page's `zoomToPanel` runs, `letterboxFadingRef = false` → bars fade back to full opacity framing the new panel.
- **`setCurrentPanelIndex(-1)` + page change**: fall back to opacity 0 (no panel, no bars).

### 5. Toggle UI and persistence

`ReaderSettingsModal` receives two new props: `focusMode: boolean` and `onFocusModeChange(value: boolean)`. The toggle renders inside the same `!isVertical` block as Smart Panel Zoom, wrapped in a `{smartPanelZoom && ( ... )}` conditional so it disappears entirely when SPZ is off. Styling matches the existing toggle row; a subdued `text-xs text-white/40` helper line below the label explains the feature in one sentence.

`MangaReader` mirrors the `smartPanelZoom` pattern: `useState` initialized from `localStorage.getItem('focusMode') === 'true'`, and a `handleFocusModeChange` callback that writes back to `localStorage` and calls `writeLetterbox()` so bars appear or fade immediately.

Turning SPZ off while Focus Mode is on leaves `focusMode` true in storage (harmless — gated at render) so re-enabling SPZ restores the previously chosen Focus Mode state without a second tap.

### 6. Rendering perf

All per-frame updates go through direct `.style` writes on the four div refs; no React state is touched during gestures. This matches the existing pattern for `applyZoomTransform`. Letterbox transitions piggyback on the GPU-accelerated compositor since we only animate `top/left/width/height/opacity` on absolutely-positioned elements (no layout of siblings).

## Risks / Trade-offs

- **Bbox-based framing may clip overflowing dialogue bubbles that the detector missed.** → Already mitigated: the 8% adaptive margin used by `computePanelTransform` and shared here catches most overflow. If specific panels still clip, users can double-tap-out to disable focus momentarily, or toggle Focus Mode off.
- **During fast pinch, per-frame projection adds a few floating-point ops per frame.** → Negligible (~dozens of ops) next to the pinch transform computation itself; writes are batched into the same animation frame as the wrapper transform update.
- **Cross-page transitions rely on the fade to hide a rect interpolation that wouldn't make sense.** → Acceptable trade — the fade is short (150 ms), and the strip slide provides its own visual motion cue.
- **If `panelRectRef` goes stale (e.g., a viewport resize while zoomed)**, bars could sit in the wrong place. → Extend the existing resize observer used by the zoom code to also call `updatePanelRect` for the current panel and re-write the letterbox.
- **PDF pages without detected panel data on a SPZ-enabled volume** fall through to full-page view. → Focus Mode simply stays invisible because `isZoomedRef` is false; no extra handling needed.
