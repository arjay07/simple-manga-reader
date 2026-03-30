## Context

The manga reader in `MangaReader.tsx` has grown to support multiple reading modes (single page, spread, vertical scroll, smart panel zoom) and multiple input methods (keyboard, arrow buttons, tap/click zones, touch swipe, scroll wheel, scrub bar/dropdown). Each input handler independently decides how to navigate, leading to 6+ separate code paths that handle mode detection, direction mapping, animation, and panel zoom differently.

The smart panel zoom feature added `advancePanel`/`retreatPanel` functions that handle within-page panel stepping and cross-page panel transitions with pre-rendered zoomed canvases. However, these are only invoked by some input handlers (swipe, wheel, click) — keyboard and arrow buttons bypass them entirely. Additionally, when the current page has no panel data (cover, full-bleed, blank), `advancePanel` returns false immediately, and the fallback path slides in an unzoomed neighbor canvas, causing a visible flash before auto-zoom kicks in.

## Goals / Non-Goals

**Goals:**
- All input methods produce identical navigation behavior for a given reading mode
- Transitioning between non-panel and panel pages is seamless (no flash of unzoomed content)
- Carousel slide animation is the standard visual transition for all paginated navigation (except direct jumps)
- Keyboard arrows and arrow buttons work with smart panel zoom
- Scroll wheel works in spread mode
- Container click supports backward navigation in panel zoom mode

**Non-Goals:**
- Changing the vertical scroll mode navigation (it uses native browser scrolling)
- Adding new input methods or gestures
- Changing the panel detection or panel data loading logic
- Refactoring the rendering pipeline (canvas management, hi-res rendering)
- Adding keyboard navigation to vertical mode (separate concern)

## Decisions

### 1. Introduce `navigateReading(direction)` as the single navigation entry point

All input handlers will call `navigateReading('forward' | 'back')` instead of directly calling `goNextPage`, `goPrevPage`, `advancePanel`, `retreatPanel`, or `animateStrip`.

`navigateReading` implements this decision tree:
1. If smart panel zoom is active and current page has panels → `advancePanel`/`retreatPanel` (existing logic)
2. If smart panel zoom is active and current page has NO panels but next/prev page has panels → new cross-type transition (pre-render zoomed, slide in)
3. If smart panel zoom is active and neither page has panels → `animateStrip` (normal carousel)
4. If not panel zoom → `animateStrip` for single-page carousel, `goNextPage`/`goPrevPage` for spread mode
5. Panel functions that return `false` (end/start of volume) → fall through to `animateStrip` which handles end-of-volume overlay

**Alternative considered:** Keep separate handlers but add panel zoom checks to each. Rejected because it's the pattern that created the problem — each handler has to remember to check panel zoom, and new handlers will forget.

### 2. Extend `advancePanel`/`retreatPanel` to handle non-panel→panel transitions

Rather than creating a new function, extend the existing `advancePanel` so that when the current page has no panels, it looks ahead to the next page. If the next page has panels, it does the same pre-render-and-slide as the existing panel→panel cross-page transition. If the next page also has no panels, it returns `false` to let `navigateReading` fall through to `animateStrip`.

This keeps the cross-page zoom logic in one place and reuses the existing canvas pre-render + strip slide mechanism.

**Alternative considered:** New standalone function `transitionToPanel`. Rejected because 90% of the code would duplicate `advancePanel`'s cross-page branch.

### 3. Input handlers only map physical input to logical direction

Each handler becomes thin:
- Keyboard: `ArrowLeft` in RTL → `'forward'`, in LTR → `'back'` → `navigateReading(direction)`
- Touch swipe: compute `isForwardSwipe` from `dx` and `effectiveDirection` → `navigateReading(direction)`
- Click zones: left zone → `'back'`, right zone → `'forward'` (swapped in RTL) → `navigateReading(direction)`
- Scroll wheel: `deltaY > 0` → `'forward'` → `navigateReading(direction)`
- Arrow buttons: left arrow → `'back'`, right arrow → `'forward'` (swapped in RTL) → `navigateReading(direction)`

The direction-to-RTL mapping happens once in each handler, then `navigateReading` handles everything else.

### 4. Animation consistency via `animateStrip` as the default page turn

For non-panel-zoom paginated navigation, `animateStrip` becomes the default. `goNextPage`/`goPrevPage` are only called:
- By `commitPageChange` (at the end of a strip animation)
- By `advancePanel`/`retreatPanel` (after their own strip animation)
- By `handlePageChange` (direct jumps from scrub bar/dropdown — no animation)

Keyboard and arrow buttons will no longer call `goNextPage` directly; they go through `navigateReading` → `animateStrip`.

### 5. Spread mode scroll wheel uses `goNextPage`/`goPrevPage` directly

Spread mode doesn't use the carousel strip (two canvases side-by-side), so `animateStrip` doesn't apply. Scroll wheel in spread mode will call `goNextPage`/`goPrevPage` directly, matching what keyboard already does.

## Risks / Trade-offs

- **[Risk] Timing regressions in strip transitions** → The carousel animation depends on precise sequencing (slide → copy canvas → snap back → state update). Routing all navigation through a single function doesn't change this sequencing, but refactoring the callers could introduce subtle timing bugs. Mitigation: test each input method × each page type combination manually.

- **[Risk] `advancePanel` complexity increases** → Adding non-panel→panel handling makes an already complex function longer. Mitigation: extract the shared "pre-render zoomed canvas and slide" logic into a helper called by both the current-page-has-panels and current-page-has-no-panels branches.

- **[Trade-off] Keyboard navigation now has 280ms double-tap delay in panel mode** → No, keyboard doesn't go through tap detection. `navigateReading` calls `advancePanel` directly, no delay.

- **[Trade-off] Arrow button clicks will animate instead of instant-jump** → This is intentional and matches user expectations. The carousel slide is 250ms, which feels responsive.
