# Tasks

> **Sequencing:** Phase 1 → Phase 2 → Phase 3 → Phase 4. Each phase is one or more standalone PRs. Behaviour must not change between phases — verify with the smoke matrix in §6 at every checkpoint.

## 1. Phase 1 — pure utilities & low-risk subcomponents

- [ ] 1.1 Create `src/components/Reader/panel-zoom-geometry.ts` exporting `computeStopGeometry`, `computeStopCount`, `computePanelTransform`. Move the existing implementations from `MangaReader.tsx:32–88` and `1241–1417`. Pure inputs only — no refs, no React. Add JSDoc on each export
- [ ] 1.2 Update `MangaReader.tsx` to import from the new module; delete the old function bodies
- [ ] 1.3 Verify zoom geometry by stepping through a CBZ and a PDF volume on both LTR and RTL series

**Checkpoint B1.1**: geometry extracted. PR.

- [ ] 1.4 Create `src/components/Reader/use-reading-progress.ts` exporting `useReadingProgress({ profileId, volumeId, totalPages })` returning `{ currentPage, setCurrentPage, restoreInitial }`. Owns the localStorage write and the debounced `/api/progress` POST currently at `MangaReader.tsx:893–916`
- [ ] 1.5 Wire the hook into `MangaReader.tsx`; delete the inline progress logic
- [ ] 1.6 Verify resume on reopen for both PDF and CBZ; verify localStorage entry clears after server write

**Checkpoint B1.2**: progress extracted. PR.

- [ ] 1.7 Create `src/components/Reader/use-reading-direction.ts` exporting `useReadingDirection({ settings })` returning `{ direction, getNeighborPages, pickSlot, swipeSign }`. Move logic from `MangaReader.tsx:137–139, 753–758, 1420–1430`
- [ ] 1.8 Wire the hook into `MangaReader.tsx`
- [ ] 1.9 Verify LTR and RTL navigation still flip correctly when toggled in settings mid-session

**Checkpoint B1.3**: direction extracted. PR.

- [ ] 1.10 Create `src/components/Reader/use-canvas-render.ts` exporting `useCanvasRender({ documentSource, dpr })` returning `{ renderPage, cancelInFlight }`. Move `renderPage` callback from `MangaReader.tsx:703–750`. Preserve PdfRenderTask cancellation semantics
- [ ] 1.11 Wire the hook; remove the inline callback
- [ ] 1.12 Verify high-DPR rendering on a Retina-class display; verify rapid page swipes don't leak stale renders

**Checkpoint B1.4**: render hook extracted. PR.

- [ ] 1.13 Create `src/components/Reader/LetterboxFrame.tsx` taking `{ panel, focusMode, smartPanelZoom, isZoomed, writeRef }` and owning the imperative DOM manipulation at `MangaReader.tsx:248–259, 301–504, 3046–3056`
- [ ] 1.14 Wire the component; remove the inline letterbox JSX and effects from `MangaReader.tsx`
- [ ] 1.15 Verify focus-mode bars enter, morph, and fade correctly on panel-to-panel and cross-page transitions; verify they suppress correctly during strip slide animations (`letterboxFadingRef` semantics)

**Checkpoint B1.5**: letterbox extracted. PR.

- [ ] 1.16 Create `src/components/Reader/PanelDebugOverlay.tsx` taking `{ panelDataMap, currentPage, enabled }`. Move from `MangaReader.tsx:2985–3031`
- [ ] 1.17 Wire and verify; debug overlay renders rectangles + confidence labels per page

**Checkpoint B1.6**: debug overlay extracted. PR.

## 2. Phase 2 — gesture & zoom hooks

- [ ] 2.1 Create `src/components/Reader/use-panel-zoom.ts` exporting `usePanelZoom({ ... })` returning `{ isZoomed, panelDataMap, hasPanelData, currentPanelIndex, panelStopTick, enterZoom, exitZoom, zoomToPanel }`. Move state at `MangaReader.tsx:215–245` and logic at `1241–1417, 2263–2334`. Consumes `panel-zoom-geometry`. Document any refs the parent must still own (e.g. canvas refs)
- [ ] 2.2 Wire into `MangaReader.tsx`; delete the inlined state and callbacks
- [ ] 2.3 Smoke matrix: enter zoom on first/middle/last panel of a page, advance through stops, retreat, exit zoom

**Checkpoint B2.1**: panel zoom hook extracted. PR (medium-sized).

- [ ] 2.4 Create `src/components/Reader/use-carousel-navigation.ts` exporting `useCarouselNavigation({ ... })` returning `{ stripRef, isAnimatingRef, dragOffsetRef, animateStrip, springBack, setStripTransform, navigateReading }`. Move logic at `MangaReader.tsx:918–1040, 2091–2139, 2141–2161`
- [ ] 2.5 Wire into `MangaReader.tsx`
- [ ] 2.6 Smoke matrix: arrow keys, swipe page-turn, tap-to-turn zones, mid-animation interrupt

**Checkpoint B2.2**: carousel hook extracted. PR.

- [ ] 2.7 Create `src/components/Reader/use-gesture-handlers.ts` exporting `useGestureHandlers({ panelZoom, carousel, ... })` returning `{ onTouchStart, onTouchMove, onTouchEnd, onWheel, onContainerClick }`. Move handlers and refs at `MangaReader.tsx:2163–2864`
- [ ] 2.8 Wire into `MangaReader.tsx`
- [ ] 2.9 Smoke matrix: pinch (2-finger zoom in/out + pan), single-finger pan when zoomed, double-tap zoom, swipe with velocity, tap toolbar toggle, wheel scroll on desktop

**Checkpoint B2.3**: gesture hook extracted. PR (large; budget extra QA).

## 3. Phase 3 — high-risk extractions

- [ ] 3.1 Create `src/components/Reader/use-cross-page-prerender.ts` exporting the prerender lifecycle. Move logic at `MangaReader.tsx:1419–1843, 1849–1970`. Carefully document: read-after-write coordination on `commitNeighborSlide`, `letterboxFadingRef` gating, `activeCommitListenerRef` cleanup on pinch-interrupt, `crossPageReadyRef` invalidation on page change
- [ ] 3.2 Wire into `MangaReader.tsx`. The hook must accept stable callbacks for any state setter it doesn't own
- [ ] 3.3 Targeted regression matrix:
  - 3.3.1 Last-panel-of-N + zoomed → swipe forward → first-panel-of-N+1 transition is seamless (no flicker, no double-render)
  - 3.3.2 Same with RTL series
  - 3.3.3 Mid-prerender pinch interrupt does not leak listeners (verify via DevTools listener count over 20 cycles)
  - 3.3.4 Rapid forward+back page swipes do not desync `crossPageReadyRef`
  - 3.3.5 End-of-volume case (last panel of last page → next-volume overlay) still works

**Checkpoint B3.1**: prerender hook extracted. PR (high QA budget).

- [ ] 3.4 Create `src/components/Reader/CarouselStrip.tsx` taking forwarded refs for the three canvases and three zoom wrappers. Move JSX from `MangaReader.tsx:2963–3041`
- [ ] 3.5 Wire and verify

**Checkpoint B3.2**: carousel strip subcomponent extracted. PR.

## 4. Phase 4 — cleanup

- [ ] 4.1 Delete any branches in `MangaReader.tsx` made dead by the extractions
- [ ] 4.2 Audit hook dependencies for hidden coupling: ensure no two hooks share module-level mutable state; if any do, document why
- [ ] 4.3 Confirm `MangaReader.tsx` is < 1,400 lines (target ~1,200)
- [ ] 4.4 Update `CLAUDE.md` "Architecture / Key patterns" with the new hook + component map under `src/components/Reader/`
- [ ] 4.5 Update any spec under `openspec/specs/` whose prose pinpoints `MangaReader.tsx:NNN` line numbers (one-line edits)

## 5. Coordination

- [ ] 5.1 Confirm `add-cbz-support` is archived before starting §1
- [ ] 5.2 Confirm `establish-shared-foundations` is at least at Checkpoint A1 (domain types) — the reader's prop types should reference the central `Profile`/`Volume` rather than redefining them in the new hooks

## 6. Verification matrix (run at every checkpoint)

- [ ] 6.1 PDF volume opens and renders page 1
- [ ] 6.2 CBZ volume opens and renders page 1
- [ ] 6.3 Page nav: arrows + swipe in LTR; arrows + swipe in RTL
- [ ] 6.4 Pinch zoom in/out (1.5×, 3×, 5×); pan while zoomed
- [ ] 6.5 Smart panel zoom: enter, advance through panels of a page, exit
- [ ] 6.6 Smart panel zoom: cross-page transition (last panel of N → first panel of N+1)
- [ ] 6.7 Focus-mode letterbox bars render and suppress correctly during slides
- [ ] 6.8 Vertical mode toggle works
- [ ] 6.9 End-of-volume overlay appears and links to next volume
- [ ] 6.10 Settings modal saves and applies (debounced)
- [ ] 6.11 Progress: close at page N, reopen, restored to page N
- [ ] 6.12 Debug overlay (admin) renders panel rectangles
- [ ] 6.13 `npm run lint` and `npm run build` clean

## 7. Rollback

- [ ] 7.1 Each phase is a separate PR — revert is single-PR granularity
- [ ] 7.2 If Phase 3 regressions are intractable, revert to end of Phase 2; reader is still ~1,500 lines smaller and benefits from the cleaner hook split. Document the deferral and re-attempt after the relevant landmines are de-risked
