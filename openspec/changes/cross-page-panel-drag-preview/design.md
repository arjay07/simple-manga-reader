## Context

`MangaReader.tsx` already supports two distinct touch behaviors when zoomed in Smart Panel Zoom mode:

- **Within-page panel drag** (`handleTouchMove` lines 1924–1938): `handleTouchStart` pre-resolves the next/prev panel's transform on the *same* canvas and stashes it on `panelDragRef`. During the drag, `applyInterpolatedTransform` lerps the wrapper transform between start and target by drag progress, and Focus Mode's `writeLetterbox` morphs the bar rect between the from-panel and to-panel projections.
- **Cross-page panel drag** (`handleTouchMove` lines 1916–1921): `forwardTarget` / `backwardTarget` are `null` because the next panel lives on a different canvas. The drag rubber-bands the current wrapper with `resistance = 0.15` and the letterbox is left in its current state (no morph). On release, `handleTouchEnd` calls `navigateReading` → `advancePanel`/`retreatPanel` → `slideToZoomedPage`, which awaits a hi-res render of the neighbor page (100–400 ms), fades the letterbox out, and runs a 250 ms strip-slide.

This change wants the cross-page case to feel like the within-page case: the neighbor page should follow the finger, and the letterbox should morph between the two panels' rects as it does on same-page drags.

## Goals / Non-Goals

**Goals:**
- Cross-page touch drag previews the neighbor page in real time when pre-rendered.
- Letterbox bars morph through the cross-page slide, framing whichever panel is currently centered.
- Pre-render cost is paid eagerly when the user reaches a boundary panel, not at gesture start.
- Existing behavior preserved as a fallback (rubber-band + post-release `slideToZoomedPage`) when neighbor is not yet ready.
- Keyboard, wheel, button, and tap navigation across page boundaries are unaffected.

**Non-Goals:**
- No change to spread mode or vertical mode (cross-page drag preview is single-page horizontal only).
- No new pre-rendering on non-boundary panels — only the immediate boundary triggers neighbor pre-render.
- No new pre-rendering of two-pages-away neighbors.
- No change to within-page drag, pinch, double-tap, or settings UI.

## Decisions

### Pre-render timing: on entering a boundary panel

Trigger neighbor pre-render via a `useEffect` keyed on `(currentPage, currentPanelIndex, panelStop, isZoomed, smartPanelZoom, panelDataMap)`. When the user lands on the last panel of `currentPage` and a next-page exists with panel data, render the next page into the next/prev slot (whichever `slideToZoomedPage` would pick for forward) and compute the target transform for its first panel. Mirror for the first panel → previous page.

**Why not at touch start?** Render is async (~100–400 ms). Touch start would either block the gesture or fall back too often.

**Why not always pre-render both neighbors?** Wasteful; users mostly traverse panels mid-page. Boundary entry is the natural trigger.

**Alternative considered:** pre-render on the *previous* panel (one ahead of the boundary) for even more headroom. Rejected for first iteration — boundary entry is simpler and panel-to-panel transitions take enough time (~200 ms zoom transition) that a render kicked off then often finishes before the user swipes.

### Cross-page target stash on `panelDragRef`

Extend `panelDragRef` with optional `crossPageForward` / `crossPageBackward` shapes:

```ts
type CrossPageTarget = {
  pageNum: number;
  slot: 'prev' | 'next';
  panel: Panel;
  panelIndex: number;
  stopIndex: number;       // resolved (-1 → last) at pre-render time
  transform: PanelTransform; // pre-computed for the neighbor canvas
};
```

`handleTouchStart` populates these from a new `crossPageReadyRef` (set by the pre-render effect) only when the appropriate boundary condition holds. Within-page `forwardTarget`/`backwardTarget` take priority — cross-page only fires when both are null in their respective direction.

### Cross-page drag in `handleTouchMove`

When `crossPageForward`/`crossPageBackward` is present and the drag is in that direction:

1. Compute `progress = clamp(|adjustedDx| / window.innerWidth, 0, 1)` — full-viewport drag = full slide.
2. Set the strip's `transform: translateX(...)`:
   - Base position is `-100vw` (current centered in the 3-slot strip).
   - Forward + RTL or Backward + LTR uses prev slot → strip goes to `0` at progress 1.
   - Forward + LTR or Backward + RTL uses next slot → strip goes to `-200vw` at progress 1.
3. The neighbor wrapper already has the pre-computed transform applied (set once at boundary pre-render). The current wrapper stays at its drag-start transform.
4. Call `writeLetterbox({ crossPage: { fromPanel, fromTransform, toPanel, toTransform, slot, stripTranslateX, progress } })`.

The current page's wrapper transform is **not** modified during cross-page drag (no rubber-band) — its visual motion comes from the strip translation alone.

### Letterbox cross-page morph

`writeLetterbox` today (lines 287–298) projects two panels through two transforms on a single canvas and lerps the resulting rects in viewport space. Generalize:

- `fromRect` = project `fromPanel` through `fromTransform` on the **current** page's canvas (offset by the current slot's strip x = `stripTranslateX - (-100vw)` = `stripTranslateX + 100vw`).
- `toRect` = project `toPanel` through `toTransform` on the **neighbor** page's canvas (offset by the neighbor slot's strip x: `0` for prev, `-200vw` for next, then add `stripTranslateX + 100vw`).
- Lerp the two viewport-space rects by `progress` to get the bar rect.

At `progress = 0`, `stripTranslateX = -100vw` so `fromRect` is at viewport center and `toRect` is one viewport off — bars frame from-rect. At `progress = 1`, the strip has slid fully and `toRect` is at viewport center — bars frame to-rect. The morph is a smooth interpolation in between. No fade.

This matches the within-page lerp algebra; the only added complexity is the strip-translation offset.

### Commit / cancel in `handleTouchEnd`

Reuse existing thresholds (`commitThreshold = 0.2 * vw`, `velocity > 0.3 px/ms`).

**Commit (cross-page):**
- Animate the strip from current `progress` translateX to the target slot translateX with a transition matching today's 250 ms ease-out (proportional duration: `250 * (1 - progress)`).
- Reuse `slideToZoomedPage`'s `onSlideEnd` cleanup — extract into a `commitNeighborSlide(target)` helper that copies the neighbor canvas into the current canvas, snaps strip back, sets zoom refs, calls `goNextPage`/`goPrevPage`, syncs `currentPageRef`, and re-applies the zoom transform in a `requestAnimationFrame`.
- Letterbox: bars are already on the to-rect at progress 1; helper sets `letterboxFadingRef = false` and lets the next `writeLetterbox` from `applyZoomTransform` re-anchor without fade.

**Cancel (cross-page):**
- Animate strip from current translateX back to `-100vw` with an ease-out transition (proportional duration).
- Re-issue `writeLetterbox` per `requestAnimationFrame` during the cancel transition (or transition the rect via the existing CSS path) so bars spring back to from-rect.
- Leave neighbor wrapper transform in place for next gesture; the next pre-render effect cycle will handle invalidation if the user moves panels.

### Slot lifecycle and `animateStrip` coordination

`animateStrip` is the carousel's normal page-turn driver. It's only invoked from `navigateReading` when smart-panel mode is *not* active or the panel-mode path returns false. Cross-page drag preview only runs when zoomed in panel mode, so there's no live conflict — but we must not leave the neighbor slot's wrapper in a stale state after cancel, since a later non-panel page turn could surface it. Mitigation: on cancel, leave the neighbor transform in place (it remains valid for the same neighbor page); on `currentPage` change *not* via cross-page commit, reset both neighbor wrappers (existing code at `navigateReading` lines 1701–1706 already does this for the fallback path — extend the same reset to fire when leaving a boundary panel without committing).

### Render task management

Use the existing `prevRenderTaskRef` / `nextRenderTaskRef` pattern from `slideToZoomedPage`. The pre-render effect cancels the in-flight task before starting a new one and clears `crossPageReadyRef` until the render resolves. If the user leaves the boundary before render finishes, cancel the task.

## Risks / Trade-offs

- **Stale neighbor wrapper after cancel** → A subsequent within-page panel change repaints the neighbor on the next boundary entry; the wrapper's transform is harmless until the next cross-page drag, which will recompute it via the pre-render effect.
- **Pre-render on every boundary entry costs CPU** → Only one extra render per boundary, and only while zoomed; if the user is just flipping pages without zoom, no pre-render fires.
- **Reading direction × slot mapping is easy to get wrong** → Reuse the exact `useSlot` logic from `slideToZoomedPage` (lines 1353–1359) verbatim, factored into a `pickSlot(readingDir)` helper shared by pre-render, drag, and commit.
- **Letterbox during cancel spring-back may look choppy** if we re-issue `writeLetterbox` per frame manually → Prefer driving it via a CSS transition on the bar rects matching the strip transition's duration/curve, same approach as the existing 200 ms panel-change letterbox transition.
- **Devices with slow PDF render may rarely get the live preview** → Falls back to existing rubber-band path; user gets today's behavior, no regression.
- **Pinch interrupting a cross-page drag** → `handleTouchStart`'s pinch branch already clears `panelDragRef`; cross-page state lives there too, so it gets cleared automatically. Strip translation needs to be reset to `-100vw` if a pinch starts mid-drag — extend the pinch setup to do this.

## Migration Plan

No data migration. Behavior is additive: when the new path's preconditions don't hold (no panel data on neighbor, neighbor not pre-rendered, vertical mode, spread mode), the old behavior runs unchanged. No flag needed; ship as a single change.
