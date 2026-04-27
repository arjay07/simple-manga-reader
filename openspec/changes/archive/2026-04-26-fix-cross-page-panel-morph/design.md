## Context

`MangaReader.tsx` runs a cross-page panel transition through two parallel drivers:

1. **The carousel strip** is animated by CSS: `strip.style.transition = 'transform 250ms ease-out'` then `strip.style.transform = slideTarget` (`slideToZoomedPage`, lines 1762–1763). The browser interpolates with `cubic-bezier(0, 0, 0.58, 1)` (the CSS `ease-out` keyword).
2. **The letterbox bars** are driven by a JavaScript rAF loop that recomputes `eased = 1 - (1-t)^3` each frame and calls `writeLetterbox({ dragInterp: { kind: 'cross-page', ..., progress: eased } })` (lines 1771–1793). `writeLetterbox` lerps two viewport-space rects by `progress` and writes the bar geometry (`top/left/width/height`) with `transition: 'none'` for cross-page.

These two timelines don't agree. CSS `ease-out` and pure cubic ease-out diverge by up to ~19 percentage points of progress at the slide midpoint:

| t | strip CSS y | rAF cubic 1-(1-t)³ | Δ |
|---|---|---|---|
| 0.25 | 0.41 | 0.58 | +0.17 |
| 0.50 | 0.68 | 0.88 | +0.19 |
| 0.75 | 0.89 | 0.98 | +0.09 |

The bars race ahead of the panel. There's also a sub-frame phase offset because `startTime = performance.now()` is captured before the browser commits the strip style change.

The touch cross-page commit/cancel paths in `handleTouchEnd` build the `dragInterp` payload with `fromTransform: drag.start` (lines 2389–2396, 2704–2710) — `drag.start` was captured at `handleTouchStart`. If the user pinched after touchstart and before swiping, `drag.start` no longer reflects the current wrapper transform. The morph starts from the wrong place.

`slideToZoomedPage` (the keyboard/wheel/tap path) reads live refs for `fromTransform` (lines 1744–1750), which is the pattern we want everywhere.

## Goals / Non-Goals

**Goals:**
- The cross-page letterbox morph reaches every intermediate progress at the same time the strip does, with no visible lead, lag, or curve mismatch.
- Cross-page touch drag morphs from the live wrapper transform regardless of any pinch performed mid-gesture.
- One source of truth for the morph timing (CSS), one source of truth for the from-state (live refs).
- No regression to within-page panel drags, pinch-only gestures, or non-cross-page page turns.

**Non-Goals:**
- No change to `prerenderNeighbor`, `commitNeighborSlide`, or the cross-page cache lifecycle.
- No change to the strip's own transition duration or easing.
- No change to the cross-page commit/cancel thresholds.
- Not addressing the broader FSM refactor (state-machine for panel-zoom modes, unified projection helper) — those are tracked separately.
- Not touching the eager pre-render effect's hardcoded `isLastPanel = true` / `isFirstPanel = true` (lines 1857–1858) — that's an efficiency issue, not a correctness one, and is its own scope.

## Decisions

### Decision 1: Drive the cross-page bar morph from CSS, not rAF

Replace the `stepMorph` rAF loop in `slideToZoomedPage` (lines 1771–1793) with a single `writeLetterbox` call that:

- Uses the same `dragInterp.kind === 'cross-page'` payload, but with `progress: 1` (the destination state).
- Sets the bar transition to `'top 250ms ease-out, left 250ms ease-out, width 250ms ease-out, height 250ms ease-out'` — same duration and curve as the strip.
- The `stripTranslateX` field becomes `slotEndX` (the end position) since the bars now interpolate via CSS.

**Why this works:** `writeLetterbox` writes the bar geometry to its destination value in one go; the browser interpolates the CSS properties using the requested transition curve. Because the strip uses the same curve, the bars and the strip stay phase-locked by definition. The lerp algebra in `projectOn` is the same; we just don't need to evaluate it at every intermediate `progress`.

**What about the `fromExtra` / `toExtra` math that depends on `stripTranslateX`?** Both are linear in `stripTranslateX`. At `progress = 0`, the bars sit at the from-rect's projection at `stripTranslateX = -vW`; at `progress = 1`, the bars sit at the to-rect's projection at `stripTranslateX = slotEndX`. The CSS transition between those two endpoint geometries is exactly the same trajectory as the per-frame lerp would produce — *as long as the curve matches*, which it now does.

**Edge case — the start state.** Before the first `writeLetterbox` of the cross-page morph, the bars are sitting at the from-rect with `transition: '200ms ease-out'` from prior writes. We must:

1. First write the from-rect with `transition: 'none'` to anchor the start position without animation.
2. Then `requestAnimationFrame(() => write the to-rect with the new 250ms transition)` so the browser sees a transitionable change between the anchored start and the destination.

This two-step anchor pattern is already used elsewhere in the file (e.g., `commitNeighborSlide` lines 1665–1673 setting `transition: 'none'` then `transform`). One rAF instead of an entire morph loop.

**Cancellation:** the `cancelMorph` flag and rAF loop go away. CSS transitions are auto-cancelled by reassigning the same property — if a new gesture starts mid-slide, the next `writeLetterbox` (or `commitNeighborSlide` style write) overwrites the in-flight transition.

### Decision 2: Single `liveTransform()` helper for cross-page from-state

Add a small helper at the top of the file (or inline at each site) that reads the current wrapper transform from live refs:

```ts
const liveTransform = (): PanelTransform => ({
  ox: zoomOriginRef.current.x,
  oy: zoomOriginRef.current.y,
  scale: zoomScaleRef.current,
  panX: panRef.current.x,
  panY: panRef.current.y,
});
```

Replace `drag.start` in three cross-page `dragInterp` construction sites with `liveTransform()`:

- `handleTouchMove` cross-page branch (~line 2387)
- `handleTouchEnd` cross-page commit branch (~lines 2389–2396)
- `handleTouchEnd` cross-page cancel branch (~lines 2704–2710)

`slideToZoomedPage` already uses this pattern (lines 1744–1750); we just centralize it.

**Why not also fix within-page?** Within-page already reads live refs at lines 2410–2417 (`s` is a fresh snapshot of live transform on each move). It's consistent.

**What about `drag.start` for the within-page lerp's from-state?** Still correct there — within-page drag interpolates from the snapshot at touchstart toward the canonical neighbor panel transform; both are stable through the gesture. The pinch case is handled by re-snapshotting elsewhere. We're only changing cross-page.

### Decision 3: Validate the post-commit settle before fixing it

After the final morph write at `progress = 1`, `commitNeighborSlide` runs. It copies the neighbor canvas to `destCanvas` (matching dimensions), writes the new wrapper transform, then in a `requestAnimationFrame` sets `letterboxFadingRef = false` and calls `applyZoomTransform(false)` which calls `writeLetterbox({ withTransition: false })`. That call uses the *current* (now switched) page's panel and the live refs.

In theory the rect from this post-commit `writeLetterbox` matches the morph's final rect: same panel, same canvas dims, same transform. In practice, sub-pixel rounding (`Math.round` at lines 382–385) on slightly different canvas styles or transform values could produce a 1px difference, which would cause a one-frame snap.

**Validation step (Task 3):** add temporary `console.debug` lines in both code paths emitting the four `(L, R, T, B)` values, run a cross-page slide, and compare. If they match, no fix needed. If they don't, defer `letterboxFadingRef = false` until *after* the post-commit `applyZoomTransform` writes — i.e., write first, then drop the gate, so the bars never re-render with a different rect.

This is intentionally last because the user's reported symptom is fully explained by Decisions 1 + 2; the post-commit settle (if it exists at all) is a marginal additional refinement.

## Risks / Trade-offs

- **CSS transition on four properties may be heavier than rAF rect lerp** — Each frame the browser interpolates `top/left/width/height` and triggers layout. With a single fixed-position container of four absolute-positioned bars, this is cheap; the existing within-page bar transitions already use the same pattern at 200ms.
- **The 250ms duration assumption is encoded in two places** (strip transition string and bar transition string). If the strip duration changes, the bar transition has to update too. Mitigation: extract a constant `CROSS_PAGE_SLIDE_MS = 250` and reference it at both sites.
- **Anchor-then-transition timing is delicate** — If the rAF runs before the browser has flushed the anchor write, the destination write happens against an undefined start state. Use `requestAnimationFrame` (not `setTimeout(0)`); the rAF callback fires after the browser has had a chance to paint the anchor.
- **Removing the `cancelMorph` flag** loses an explicit cancellation point — if a future gesture handler needs to know "is a cross-page slide in flight?", it'll need a different signal. `letterboxFadingRef.current === true` already encodes this; reuse it.
- **Touch cross-page sites are easy to miss** — there are three (touch-move, touch-end commit, touch-end cancel). Listing them explicitly in tasks rather than hoping a grep catches them.

## Migration Plan

No data, schema, or behavior migration. The changes are localized:

- The CSS-driven bar morph produces the same start and end rects as the rAF morph — only the trajectory changes (smoother).
- Reading live refs for cross-page `fromTransform` is strictly more correct: when no pinch occurred, live refs equal `drag.start` (no behavior change); when a pinch occurred, the morph now starts from the right place (bug fix).

No flag, no staged rollout. Single change.
