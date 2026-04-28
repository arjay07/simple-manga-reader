## Why

`src/components/Reader/MangaReader.tsx` is **3,162 lines and growing**. It is a single default-exported component that owns every concern in the reader: PDF/CBZ document loading, three-canvas carousel rendering, pinch and pan, smart panel zoom geometry, panel data fetching, cross-page panel transitions, boundary panel pre-render, panel navigation, keyboard and touch dispatch, focus-mode letterbox bars, end-of-volume overlay, debug overlay, progress save, and reading-direction logic.

Effects in this file commonly depend on 6+ state vars and call 4+ callbacks; a structural audit identified five "landmines" — canvas ref chains, effect dependency edges, read-after-write in cross-page commits, the cross-page drag state machine, and `letterboxFadingRef` gating — that any naive split would regress. The reader is also the first place a new feature is added (it was the touch-point for `add-cbz-support`, `cross-page-panel-drag-preview`, and `smart-panel-zoom`), so every change pays the cost of navigating the monolith.

The audit identified clean seams: the geometry math is pure, several refs cluster into well-defined sub-systems (carousel, panel zoom, gestures, prerender), and a few rendered surfaces (letterbox bars, debug overlay) can come out as plain subcomponents. Splitting along those seams cuts the core file by ~40% and keeps each new module under 400 lines.

## What Changes

A phased extraction. Each phase is an independent shippable PR; behaviour does not change at any phase. After Phase 3, `MangaReader.tsx` is the orchestrator (~1,200 lines) composing hooks and subcomponents.

- **Phase 1 — pure utilities & low-risk subcomponents** (no shared mutable state)
  - `src/components/Reader/panel-zoom-geometry.ts`: extract `computeStopGeometry`, `computeStopCount`, `computePanelTransform` (currently lines 32–88, 1241–1417). Pure functions taking panel coords + viewport + reading direction; return transform descriptors.
  - `useReadingProgress` hook: owns `currentPage`, debounced localStorage write, debounced `/api/progress` POST (lines 142–153, 893–916).
  - `useReadingDirection` hook: owns LTR/RTL inference, neighbour-page resolution, slot picking (lines 137–139, 753–758, 1420–1430).
  - `useCanvasRender` hook: owns the `renderPage` callback with DPR scaling and PdfRenderTask cancellation (lines 703–750).
  - `<LetterboxFrame />` subcomponent: takes the current panel + focus-mode state, owns the imperative DOM manipulation currently inline at lines 248–259, 301–504, and 3046–3056.
  - `<PanelDebugOverlay />`: lift lines 2985–3031 into its own component.

- **Phase 2 — gesture and zoom hooks** (clustered refs, but bounded surface)
  - `usePanelZoom` hook: owns the entire smart-panel-zoom lifecycle — `isZoomed`, `zoomScaleRef`, `zoomOriginRef`, `panRef`, `currentPanelIndex`, `panelStopTick`, `panelStopRef`, `panelDataMap`, panel data prefetch, `enterZoom`/`exitZoom`/`zoomToPanel`. Consumes `panel-zoom-geometry`.
  - `useCarouselNavigation` hook: owns `isAnimatingRef`, `dragOffsetRef`, `stripRef`, `animateStrip`, `springBack`, `setStripTransform`, and the unified `navigateReading` dispatcher (lines 918–1040, 2091–2139, 2141–2161).
  - `useGestureHandlers` hook: owns `touchStartRef`, `pinchStateRef`, `panelDragRef`, `lastTapRef`, and the three handlers (`handleTouchStart`, `handleTouchMove`, `handleTouchEnd`) plus the wheel handler. Consumes `usePanelZoom` and `useCarouselNavigation` outputs.

- **Phase 3 — high-risk extractions** (tied to the landmines)
  - `useCrossPagePrerender` hook: owns `crossPageReadyRef`, `prerenderTaskCancelRef`, `activeCommitListenerRef`, `prerenderNeighbor`, `commitNeighborSlide`, `slideToZoomedPage` (lines 1419–1843, 1849–1970). Must coordinate with `useCarouselNavigation` and `usePanelZoom` for the read-after-write commit sequence and `letterboxFadingRef` gating.
  - `<CarouselStrip />` subcomponent: owns the three-canvas DOM and ref forwarding (lines 2963–3041). Cosmetic but cleans the main render tree.

- **Phase 4 — cleanup**
  - Delete dead branches inside `MangaReader.tsx` exposed by the extractions; finalise prop/ref contracts; ensure no hook reaches into another's internals via shared module-level state.

After Phase 3, the reader file owns: the providers/context wiring, the document-source `useEffect`, hook composition, render tree, and the end-of-volume + settings modal mounts. Everything else moves out.

## Capabilities

### Modified Capabilities

- `pdf-rendering-quality`, `pinch-zoom`, `smart-panel-zoom`, `focus-mode`, `pdf-page-prerender`, `progress-resume` — all currently document behaviour anchored in `MangaReader.tsx`. Specs do not need to change because the externally observable behaviour is preserved; module locations referenced in spec prose may need a one-line update each.

### New Capabilities

- None. This is a structural refactor.

## Impact

- **Code**
  - New: `src/components/Reader/panel-zoom-geometry.ts`, `src/components/Reader/use-reading-progress.ts`, `use-reading-direction.ts`, `use-canvas-render.ts`, `use-panel-zoom.ts`, `use-carousel-navigation.ts`, `use-gesture-handlers.ts`, `use-cross-page-prerender.ts`, `LetterboxFrame.tsx`, `PanelDebugOverlay.tsx`, `CarouselStrip.tsx`.
  - Touched: `src/components/Reader/MangaReader.tsx` shrinks from 3,162 → ~1,200 lines.
- **APIs / contracts**: none external. Internal hook + component contracts are new.
- **Risk**: medium. Phases 1 and 2 are tractable; Phase 3 has identified read-after-write and ref-coordination hazards that need careful sequencing and a manual smoke matrix. Each phase ships independently — if Phase 3 turns out to be too risky, the reader still benefits from Phases 1+2 alone.
- **Verification**: a documented manual smoke matrix per phase covering: PDF + CBZ load, page nav (LTR + RTL), pinch zoom, smart panel zoom enter/exit, panel-to-panel within page, cross-page panel transition, focus-mode letterbox, end-of-volume overlay, settings modal, debug overlay, vertical mode, progress restore on reopen.
- **Coordination**: do **not** start Phase 1 until the active `add-cbz-support` change is archived. The CBZ work has open verification and cleanup tasks that touch the reader.

## Out of Scope

- Adding new reader features. Refactor only.
- Migrating the reader to React Compiler or `useEvent`.
- Changing the carousel/three-canvas approach itself.
- Replacing pdfjs or JSZip.
