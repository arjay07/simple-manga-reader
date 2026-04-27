## 1. Replace rAF morph with CSS-driven bar transition

- [ ] 1.1 In `src/components/Reader/MangaReader.tsx` `slideToZoomedPage`, extract the slide duration to a top-of-function constant `const SLIDE_MS = 250` and use it for both `strip.style.transition = 'transform ${SLIDE_MS}ms ease-out'` (line 1762) and the new bar transition string (task 1.3).
- [ ] 1.2 Extend `writeLetterbox`'s `opts` to support an explicit transition duration override for the cross-page case — e.g., a `crossPageTransitionMs?: number` field on `dragInterp` for `kind: 'cross-page'`. When set, the bar transition string SHALL be `'top ${ms}ms ease-out, left ${ms}ms ease-out, width ${ms}ms ease-out, height ${ms}ms ease-out'`. When unset, fall back to today's behavior (cross-page → `'none'`).
- [ ] 1.3 In `slideToZoomedPage`, replace the `stepMorph` rAF loop (lines 1771–1793) with:
  - First, a `writeLetterbox` call at `progress: 0`, `stripTranslateX: -vW`, no transition override — anchors the bars at the from-rect with `transition: 'none'`.
  - Then a `requestAnimationFrame` that issues a second `writeLetterbox` at `progress: 1`, `stripTranslateX: slotEndX`, `crossPageTransitionMs: SLIDE_MS` — destination rect with the matching CSS transition.
  - Remove the `cancelMorph` flag and its references (`onSlideEnd` no longer needs to set it because there is no rAF loop to cancel).
- [ ] 1.4 Manual verification: keyboard arrow forward across a page boundary while zoomed in panel mode produces a letterbox morph that visually tracks the strip's motion at every point — no race-ahead, no settle-snap. Repeat for backward, RTL, mouse wheel, tap-to-turn, and arrow buttons. _(requires human verification)_
- [ ] 1.5 Manual verification: rapid keyboard arrow presses while a cross-page slide is in flight do not produce visual corruption — the new gesture either replaces the in-flight transition cleanly or queues correctly. _(requires human verification)_

## 2. Read live transform for touch cross-page morph

- [ ] 2.1 Add a small helper inside the `MangaReader` component near the other transform helpers:
  ```ts
  const liveTransform = useCallback((): PanelTransform => ({
    ox: zoomOriginRef.current.x,
    oy: zoomOriginRef.current.y,
    scale: zoomScaleRef.current,
    panX: panRef.current.x,
    panY: panRef.current.y,
  }), []);
  ```
- [ ] 2.2 In `handleTouchMove`'s cross-page branch (~line 2387), replace the `fromTransform: drag.start` field of the `dragInterp` payload with `fromTransform: liveTransform()`.
- [ ] 2.3 In `handleTouchEnd`'s cross-page commit branch (~lines 2389–2396), replace `fromTransform: drag.start` with `fromTransform: liveTransform()`.
- [ ] 2.4 In `handleTouchEnd`'s cross-page cancel branch (~lines 2704–2710), replace `fromTransform: drag.start` with `fromTransform: liveTransform()`.
- [ ] 2.5 Manual verification: with Smart Panel Zoom + Focus Mode on, on the last panel of a page, pinch in slightly (final scale stays above the fit threshold so panel mode survives), then drag toward the next page. The neighbor page should follow the finger and the letterbox morph should start from the pinched view, not snap back to the pristine panel transform. Repeat for backward and RTL. _(requires human verification on touch device or DevTools touch emulation)_

## 3. Validate (and only then fix) post-commit settle

- [ ] 3.1 In `slideToZoomedPage`, log the final cross-page bar rect just before `commitNeighborSlide` runs (use the projected `(L, R, T, B)` integers; can read them from `lastLetterboxWriteRef.current`).
- [ ] 3.2 In the post-commit rAF (line 1711–1714), log the bar rect immediately after `applyZoomTransform(false)` writes via `writeLetterbox`.
- [ ] 3.3 Run a cross-page slide in each of: forward LTR, backward LTR, forward RTL, backward RTL, single-stop target panel, multi-stop target panel. Compare logs.
- [ ] 3.4 If the rects differ in any case: defer the `letterboxFadingRef.current = false` clear until immediately after `applyZoomTransform(false)` returns (i.e., write the post-commit rect first, then drop the gate). If the rects match in all cases: no code change, just remove the instrumentation.
- [ ] 3.5 Remove the temporary `console.debug` lines.

## 4. Spec deltas

- [ ] 4.1 Update `openspec/changes/fix-cross-page-panel-morph/specs/focus-mode/spec.md` with a MODIFIED `Letterbox animation on panel transitions` requirement carrying a new scenario: cross-page bar geometry transitions use the same duration and easing curve as the strip transform transition, so bars stay visually phase-locked to the panel coming into view.
- [ ] 4.2 Update `openspec/changes/fix-cross-page-panel-morph/specs/smart-panel-zoom/spec.md` with a MODIFIED `Pinch coexists with panel-by-panel navigation` requirement carrying a new scenario: cross-page swipes after a pinch interpolate from the live wrapper transform (matching the within-page behavior).

## 5. Build, lint, regression

- [ ] 5.1 `npm run build` passes.
- [ ] 5.2 `npm run lint` passes.
- [ ] 5.3 Manual smoke: within-page panel-to-panel taps still animate the letterbox at 200ms (unchanged). _(requires human verification)_
- [ ] 5.4 Manual smoke: pinch-to-zoom then pinch-out still pauses panel mode and the letterbox fades out, unchanged. _(requires human verification)_
- [ ] 5.5 Manual smoke: vertical-mode and spread-mode page turns are unaffected (cross-page panel morph is not engaged). _(requires human verification)_
- [ ] 5.6 Manual smoke: with Focus Mode off, no letterbox is ever rendered, including during cross-page slides. _(requires human verification)_

## 6. Validate change with OpenSpec

- [ ] 6.1 Run `npx openspec validate fix-cross-page-panel-morph --strict` and address any structural issues.
