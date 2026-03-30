## Context

The reader currently renders one active canvas per page in horizontal mode, switching instantly on navigation. Touch events only fire `goNextPage`/`goPrevPage` on `touchEnd` with no visual feedback during the drag. There is an existing pre-render system (`offscreenCanvasRef`) that renders the next page off-DOM, which we can build on.

The constraint is that pages are `<canvas>` elements rendered by pdfjs, not `<img>` tags — so the "carousel" must manage multiple rendered canvases rather than a CSS-only image strip.

## Goals / Non-Goals

**Goals:**
- Horizontal single-page: draggable 3-canvas strip with threshold snap on release
- Horizontal single-page: scroll wheel triggers same slide animation, debounced while animating
- Vertical: optional snap-to-page on touch release via `scrollTo`
- New `verticalSnap` setting, toggled in reader settings modal

**Non-Goals:**
- Spread mode (two-page) — unchanged
- Keyboard arrow navigation — unchanged (instant)
- Desktop arrow button click — unchanged (instant)

## Decisions

### 1. 3-canvas DOM strip for horizontal carousel

**Decision**: Keep three canvases always in the DOM (`prevCanvasRef`, `canvasRef`, `nextCanvasRef`) inside a flex-row container div. Apply `transform: translateX(...)` to the container to animate between pages.

**Why over alternatives**:
- *Alternative: 1 canvas + CSS fade* — doesn't give the spatial sliding feel.
- *Alternative: promote offscreen canvas to DOM on drag start* — causes a layout reflow mid-gesture; jank risk.
- *Always-in-DOM strip* means the layout is stable before touch starts. The container is 300vw wide, clipped by the outer `overflow: hidden` wrapper, starting at `translateX(-100vw)` (current page centered).

**Rendering**:
- On load and every page change: render prev (if exists), current, and next (if exists) into their respective canvases. Each canvas gets `widthFraction: 1` (full container width).
- Replace the existing `offscreenCanvasRef` / pre-render timer system — the strip's prev/next canvases serve the same purpose in-DOM.

### 2. Drag via touchMove + CSS transition snap

**Decision**: Track drag in `dragOffsetRef` (a ref, not state, to avoid re-renders on every pixel). Apply `transform: translateX(calc(-100vw + ${offset}px))` via direct DOM mutation (`strip.style.transform`). On `touchEnd`:
- `|offset| >= 30% of window.innerWidth` → animate to `±100vw`, then update `currentPage`, reset offset to 0 without transition
- `|offset| < 30%` → animate back to 0

CSS transition is toggled on/off: disabled during drag (so movement is immediate), enabled for the snap animation (~250ms ease-out).

**Animating lock**: `isAnimatingRef` (ref) — set true when snap animation starts, false after `transitionend`. While true, `touchStart` and `onWheel` are no-ops.

### 3. Scroll wheel triggers same animation path

**Decision**: `onWheel` handler on the container calls the same `animateToPage(direction)` function used by `touchEnd` snap. Gated by `isAnimatingRef`.

Prevent default scroll on the container to stop the page from scrolling while in horizontal mode.

### 4. Vertical snap: JS-controlled scrollTo

**Decision**: In `VerticalScrollView`, add an `onTouchEnd` handler. On release, find the canvas whose `offsetTop` is nearest to `container.scrollTop + container.clientHeight / 2` (center of viewport), then call `container.scrollTo({ top: canvas.offsetTop, behavior: 'smooth' })`.

**Why not CSS scroll-snap**: The IntersectionObserver fires on every threshold crossing. Combined with `scroll-snap-type: mandatory`, scroll restoration and programmatic scrolls (jump-to-page from the scrub bar) can fight the snap and refuse to land mid-page. JS snap avoids this by only firing on explicit touch release.

**Gate**: Only active when `snapEnabled` prop is true. The `onTouchEnd` handler is simply not attached otherwise.

### 5. verticalSnap setting storage

**Decision**: Add `verticalSnap: boolean` (default `false`) to `ReaderSettings` in `reader-settings.ts`. Persisted in the existing profile `reader_settings` JSON blob — no DB migration needed.

## Risks / Trade-offs

- **3 concurrent pdfjs renders** — rendering prev + current + next simultaneously. Mitigated by rendering them sequentially (current first, then next, then prev) so the visible page always appears first. Prev render can be low-priority (setTimeout 0 after current completes).
- **Strip reset flash** — after snap animation, we reset `translateX` from `±100vw` to `0` without transition (would be instant) while simultaneously shifting the active page. This could flash if the browser paints between the two style changes. Mitigated by batching in a `requestAnimationFrame` callback after `transitionend`.
- **Vertical snap fighting scrub bar** — if user uses the page scrub bar to jump pages, the `scrollTo` from the scrub shouldn't trigger the snap handler. Mitigated by tracking a `isProgrammaticScroll` ref that suppresses the snap on the next touchEnd.
- **Scroll wheel on trackpads** — trackpads fire many small `deltaY` values rather than discrete ticks. The `isAnimatingRef` gate handles this: the first tick fires the animation, subsequent ticks are dropped until animation completes.

## Open Questions

- Should the snap animation duration be configurable, or is 250ms hardcoded acceptable?
- On very long vertical manga (200+ pages), does the `offsetTop` lookup on touchEnd have noticeable cost? (Probably not, since it's a DOM property read, not layout thrash — but worth profiling.)
