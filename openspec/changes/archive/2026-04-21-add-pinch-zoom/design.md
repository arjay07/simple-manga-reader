## Context

`MangaReader.tsx` already has a complete zoom state machine — `zoomScaleRef`, `zoomOriginRef`, `panRef`, `applyZoomTransform`, `computePanBounds`, and a hi-res canvas re-render path (the same one used by `zoomToPanel` and the double-tap entry `enterZoom`). What's missing is a *gesture* that drives this machinery with two-finger input.

Touch today:
- `handleTouchStart` reads `e.touches[0]` and records a single-finger origin.
- `handleTouchMove` branches on `isZoomedRef` / `smartPanelZoom` / `panelDragRef` to pan, drag-between-panels, or drag the carousel strip.
- `handleTouchEnd` commits a tap, swipe, panel-drag, or pan.

All three handlers assume exactly one active finger. Multi-touch is currently untouched, which is why iOS Safari takes over and does a page-level pinch.

Smart panel mode has its own zoom state on top: `panelStopRef` (which stop within a wide panel), `currentPanelIndexRef`, `panelDragRef`. It also has a "paused" flag (`panelZoomPausedRef`) that suspends automatic panel re-zoom after a user-initiated exit — set today by double-tap-out-to-full-page. This paused flag is the hook pinch uses to break out cleanly.

## Goals / Non-Goals

**Goals:**
- Pinch to zoom in and out on paginated (single-page carousel) mode.
- Pinch works from the full-page view and from any already-zoomed state.
- Two-finger midpoint translation pans while pinching (one fluid gesture).
- Scale clamped to `[fit, 5×]`; below fit on release → exit zoom to full page.
- In smart panel mode, pinch breaks out into free zoom (panels paused) with no special-case code paths beyond setting the existing paused flag.
- On pinch release, the canvas is re-rendered at high resolution using the existing path so the final view is sharp.
- No regressions to existing single-finger behavior: tap, double-tap, swipe, one-finger zoom-pan, panel-drag.

**Non-Goals:**
- Vertical/webtoon-mode pinch. Native scroll + pinch interception is significant scope and is intentionally deferred to a follow-up change.
- Pinch "within" a panel stop that stays within the panel system. (Too fighty; pinch always exits into free zoom.)
- Rotation gesture. Manga readers don't need this.
- Momentum/inertia pan after release. Out of scope; current pan is non-inertial and that's fine.
- Reworking the existing zoom math. Pinch drives the same transform; it does not replace it.

## Decisions

### D1: Gate pinch on `touches.length === 2`, not on a separate gesture library

**Decision:** Detect pinch directly from `React.TouchEvent`. Introduce a `pinchStateRef` that is non-null during an active pinch. Handlers early-return their single-finger branches when a pinch is active.

**Why:** The existing handlers are already doing fine-grained coordination (pan bounds, panel drag, tap detection). A gesture library would need to be integrated into all three handlers and the tap/swipe state machine. Native `TouchEvent` on React's synthetic event system gives us exactly what we need with zero new deps and no coordination cost.

**Alternatives considered:**
- `use-gesture` / `@use-gesture/react` — would pull in a dep and either replace or duplicate the existing touch logic. Not worth it for one gesture.
- `PointerEvent` refactor — more modern, but would require rewriting all existing handlers. Out of scope.

### D2: Pinch always routes through free zoom; never through panel-stop math

**Decision:** On pinch start, if `smartPanelZoom && isZoomedRef.current && !panelZoomPausedRef.current`, set `panelZoomPausedRef.current = true`. The pinch then operates on `zoomScaleRef`/`zoomOriginRef`/`panRef` directly, bypassing panel-stop logic entirely.

**Why:** Panel mode's zoom is *computed* from panel geometry — a specific scale per panel, specific pan positions per stop. Letting pinch modify scale while preserving panel-stop-as-snap-target means reconciling two zoom systems (what is "the current stop" when scale ≠ computed stop scale?). The spec question users would ask is: "when I release the pinch, where should I end up?" There is no clean answer that doesn't feel fighty. Breaking out is clean, matches the existing double-tap-out pattern, and is a familiar idiom.

The user re-enters panel mode by double-tapping a panel — same as today.

**Alternatives considered:**
- Snap back to panel stop on release → fighty feel; small pinches get undone.
- Keep panel-stop scale as the minimum → confusing upper/lower bounds that differ per panel.

### D3: Pinch math — anchor the initial midpoint to the initial page point

**Decision:** Standard two-finger pinch with a "gesture-center anchor" model:

```
On 2nd finger down (pinchStart):
  mid0       = midpoint of two fingers (client coords)
  dist0      = distance between fingers
  scale0     = zoomScaleRef.current      // could be 1 (from full page) or N (already zoomed)
  pan0       = panRef.current
  origin0    = zoomOriginRef.current
  // If starting from unzoomed: set origin to the midpoint in canvas-local coords,
  // leave pan at (0,0), scale0 = 1. This makes the first pinch behave the same
  // as an instantaneous double-tap at the midpoint followed by scaling.

On pinch move:
  mid        = current midpoint
  dist       = current distance
  rawScale   = scale0 * (dist / dist0)
  scale      = clamp(rawScale, fitScale, 5)
  // Midpoint translation: the page point under mid0 should remain under mid.
  panX       = pan0.x + (mid.x - mid0.x) - origin0.x * (scale - scale0)
  panY       = pan0.y + (mid.y - mid0.y) - origin0.y * (scale - scale0)
  // No pan clamp during the gesture — clamp on release so the user can rubber-band
  // past bounds while pinching and then settle inside.
```

`fitScale = 1` (the natural CSS-fit scale the canvas already uses). We do not allow pinch-out below that — the canvas is already sized to fit; further zoom-out would just add black margin.

**Why this formula:** It gives the "point under my fingers stays under my fingers" feel that users expect. The transform-origin-is-0,0 convention already used by `applyZoomTransform` means we have to track origin separately; by re-using `zoomOriginRef` and only shifting pan, we don't have to rewrite the transform math.

**Alternatives considered:**
- Recomputing `zoomOriginRef` every pinch move to keep pan at zero → causes jumps because `origin` lives in canvas-local coords but midpoint is in client coords, and the canvas moves during pan.

### D4: Scale clamp policy — hard upper, soft lower, evaluate exit on release

**Decision:**
- During pinch: clamp `scale` hard to `[fit, 5]`. If the user pinches past 5×, they feel resistance (no visible change).
- On release: if final `scale < fit × 1.05` (small hysteresis), call `exitZoom(true)`. Otherwise clamp pan to bounds via `computePanBounds` and animate to the clamped transform.

**Why:** Evaluating exit only on release gives hysteresis for free — users who dip below fit mid-gesture and back up won't accidentally exit. A soft below-fit floor (small rubber-band) would be nicer but adds complexity; hard-clamp at fit is acceptable for v1.

**Alternatives considered:**
- Rubber-band past fit during gesture → more polish, more code, can add later.

### D5: Hi-res canvas re-render on pinch end (not during)

**Decision:** During pinch, apply CSS transforms only — no canvas re-render. On pinch end (above the exit threshold), debounced ~120ms, re-render the canvas at `min(scale, 4) × dpr × baseScale` using the same page-level render path as `zoomToPanel`.

**Why:** Re-rendering PDF pages at 60fps during a pinch would thrash the main thread and pdfjs worker. CSS transform scales the existing bitmap — it'll look soft at high zoom during the gesture, but will snap to crisp on release. This is the exact same visual pattern users see on double-tap zoom today; no new UX precedent.

**Alternatives considered:**
- Re-render at every scale tier (2×, 3×, 4×) mid-gesture → complex cancellation logic, flicker risk, marginal benefit during a fast gesture.

### D6: Transition between 2→1 fingers mid-gesture stays in zoomed state

**Decision:** When `touchend` fires and one finger remains, treat it as a pinch-end (commit scale, re-render), but keep the remaining finger's coordinates as the new `touchStartRef` so single-finger pan continues seamlessly. This requires storing the *remaining* touch identifier on pinch end.

**Why:** Users routinely pinch, lift one finger, and keep panning. Failing to handle this means the pan "jumps" or the zoom resets.

### D7: Viewport meta — suppress native iOS pinch

**Decision:** Ensure `<meta name="viewport" content="..., user-scalable=no" />` is present in `src/app/layout.tsx` (or equivalent through Next.js `viewport` metadata export). If already present, no-op; if absent, add it.

**Why:** iOS Safari without `user-scalable=no` does a page-level pinch-zoom on top of our gesture. `touch-action: none` on the reader container also blocks it, but `user-scalable=no` is simpler and PWA-friendly.

**Trade-off:** Users with accessibility zoom enabled via Safari Reader may need alternative UX. For a manga reader, in-app zoom via pinch is the accessibility path, so this is acceptable.

## Risks / Trade-offs

- **[Risk] Pinch detection fights single-finger swipe commit on quick releases.** → Mitigation: if `pinchStateRef` is set at any point during a gesture, `touchEnd` uses the pinch-end branch, *not* the swipe-detection branch. Swipe velocity/threshold checks are skipped.
- **[Risk] Initial pinch from unzoomed state jumps because `origin` is (0,0) but fingers are elsewhere.** → Mitigation: when `scale0 === 1`, set `zoomOriginRef` to the current two-finger midpoint in canvas-local coords at pinch start, so the first frame lands cleanly.
- **[Risk] `panelDragRef` was set by a preceding single-finger touchstart, then the user lifts and adds two fingers, leaving stale state.** → Mitigation: clear `panelDragRef.current = null` and `touchStartRef.current = null` on pinch start.
- **[Risk] Strip-slide animation (`isAnimatingRef`) is in flight when pinch starts.** → Mitigation: cancel the animation (existing `cancelStripTransition` path used by double-tap) and set zoom state before beginning pinch.
- **[Risk] Pinch-end canvas re-render races with page navigation if the user swipe-commits just as release happens.** → Mitigation: re-render is debounced and guarded on `isZoomedRef.current && !isAnimatingRef.current`; navigation cancels pending re-render.
- **[Trade-off] Soft visuals during pinch.** The bitmap scales without re-rendering, so text/line art looks soft at 3×+ until release. Matches current double-tap behavior; acceptable.
- **[Trade-off] Vertical mode deferred.** Users who read in webtoon mode will still be unable to pinch. Partial resolution of the original complaint; addressed in a later change.
