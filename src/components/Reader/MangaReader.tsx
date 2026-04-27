'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/ProfileProvider';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { parseReaderSettings, type ReaderSettings } from '@/lib/reader-settings';
import ReaderToolbar from './ReaderToolbar';
import ReaderBottomBar from './ReaderBottomBar';
import ReaderSettingsModal from './ReaderSettingsModal';
import VerticalScrollView from './VerticalScrollView';
import EndOfVolumeOverlay from './EndOfVolumeOverlay';
import { apiUrl } from '@/lib/basePath';
import type { Panel, PageType } from '@/lib/panel-detect/types';

interface PanelDataPage {
  pageNumber: number;
  panels: Panel[];
  pageType: PageType;
}

interface PanelDataResponse {
  pages: PanelDataPage[];
  totalPages: number;
  processedPages: number;
  isComplete: boolean;
}

interface MangaReaderProps {
  seriesId: string;
  volumeId: string;
  initialPage?: number;
  profileId?: number;
  title?: string;
  initialSettings?: string;
  fallbackDirection?: string;
  nextVolumeId?: string;
  nextVolumeTitle?: string;
  prevVolumeId?: string;
  prevVolumeTitle?: string;
}

export default function MangaReader({
  seriesId,
  volumeId,
  initialPage = 1,
  profileId,
  title = '',
  initialSettings,
  fallbackDirection,
  nextVolumeId,
  nextVolumeTitle,
  prevVolumeId,
  prevVolumeTitle,
}: MangaReaderProps) {
  const { profile } = useProfile();
  const router = useRouter();

  // Reader settings from profile or props
  const [settings, setSettings] = useState<ReaderSettings>(() =>
    parseReaderSettings(
      profile?.reader_settings ?? initialSettings,
      fallbackDirection ?? profile?.reading_direction
    )
  );

  // Update settings when profile loads
  useEffect(() => {
    if (profile) {
      setSettings(parseReaderSettings(profile.reader_settings, profile.reading_direction));
    }
  }, [profile]);

  const isVertical = settings.readingDirection === 'vertical';
  const effectiveDirection = settings.readingDirection;
  const spreadMode = settings.pageMode === 'spread' && !isVertical;

  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined' || !profileId) return initialPage;
    const key = `progress:${profileId}:${volumeId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const localPage = Number(stored);
      if (!isNaN(localPage) && localPage >= 1) {
        return Math.max(initialPage, localPage);
      }
    }
    return initialPage;
  });
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const pageRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [arrowsVisible, setArrowsVisible] = useState(false);
  const [volumeOverlay, setVolumeOverlay] = useState<'end' | 'start' | null>(null);

  // Canvas refs for carousel strip (prev / current / next)
  const canvasRef = useRef<HTMLCanvasElement>(null);      // current
  const prevCanvasRef = useRef<HTMLCanvasElement>(null);  // prev
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);  // next
  const stripRef = useRef<HTMLDivElement>(null);
  const prevZoomWrapperRef = useRef<HTMLDivElement>(null);
  const nextZoomWrapperRef = useRef<HTMLDivElement>(null);

  // Spread mode canvases (unchanged)
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const renderTaskRef2 = useRef<{ cancel: () => void } | null>(null);
  const prevRenderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const nextRenderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrowHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Carousel state (refs — no re-render needed)
  const isAnimatingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const isZoomedRef = useRef(false); // mirror for use inside callbacks without stale closure
  const zoomScaleRef = useRef(1);
  const zoomOriginRef = useRef({ x: 0, y: 0 }); // tap point in canvas-local coords
  const panRef = useRef({ x: 0, y: 0 });
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);
  const lastWheelNavRef = useRef(0); // throttle scroll wheel panel navigation
  const panStartRef = useRef({ x: 0, y: 0 }); // panRef snapshot at touch start for multi-stop panning

  // Pinch gesture state
  const pinchStateRef = useRef<{
    dist0: number;
    mid0: { x: number; y: number };
    scale0: number;
    P0: { x: number; y: number };   // canvas-local point under initial midpoint
    natLeft: number;
    natTop: number;
  } | null>(null);
  const gestureHadPinchRef = useRef(false);
  const pinchRerenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRerenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smart panel zoom state
  const [smartPanelZoom, setSmartPanelZoom] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('smartPanelZoom') === 'true';
  });
  const [panelDataMap, setPanelDataMap] = useState<Map<number, PanelDataPage>>(new Map());
  const [hasPanelData, setHasPanelData] = useState(false);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(-1); // -1 = full page view
  const currentPanelIndexRef = useRef(-1);
  // Mirror of panelStopRef as state — bumped when stop changes within the same
  // panel so the cross-page pre-render effect can re-fire on stop transitions
  // (panelStopRef alone is invisible to React deps).
  const [panelStopTick, setPanelStopTick] = useState(0);
  const autoZoomNextPageRef = useRef(false);
  const autoZoomDirectionRef = useRef<'forward' | 'back'>('forward');
  const panelStopRef = useRef(0); // current stop index within multi-stop wide panels
  const zoomToPanelRef = useRef<(panel: Panel, stopIndex?: number) => void>(() => {});
  const fullDataLoadedRef = useRef(false);
  const panelZoomPausedRef = useRef(false); // true when user double-tapped out to full page view

  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('focusMode') === 'true';
  });
  const focusModeRef = useRef(focusMode);
  const smartPanelZoomRef = useRef(false);
  const hasPanelDataRef = useRef(false);
  const panelDataMapRef = useRef<Map<number, PanelDataPage>>(new Map());
  const currentPageRef = useRef(1);
  const letterboxGroupRef = useRef<HTMLDivElement>(null);
  const letterboxTopRef = useRef<HTMLDivElement>(null);
  const letterboxBottomRef = useRef<HTMLDivElement>(null);
  const letterboxLeftRef = useRef<HTMLDivElement>(null);
  const letterboxRightRef = useRef<HTMLDivElement>(null);
  const letterboxFadingRef = useRef(false); // true during cross-page strip slide
  // Last-written bar geometry + transition; used to skip redundant DOM writes
  // during pinch/drag when the computed rect hasn't changed frame-to-frame.
  const lastLetterboxWriteRef = useRef<{
    L: number; R: number; T: number; B: number;
    vW: number; vH: number; transition: string;
  } | null>(null);

  // Panel drag state for progressive swipe between panels/stops
  interface PanelTransform { ox: number; oy: number; scale: number; panX: number; panY: number }
  interface CrossPageTarget {
    pageNum: number;
    slot: 'prev' | 'next';
    panel: Panel;
    panelIndex: number;
    stopIndex: number;
    transform: PanelTransform;
    readingDir: 'forward' | 'back';
  }
  const panelDragRef = useRef<{
    start: PanelTransform;
    startPanel: Panel;
    forwardTarget: PanelTransform | null;  // null = no within-page preview
    forwardTargetPanel: Panel | null;
    backwardTarget: PanelTransform | null;
    backwardTargetPanel: Panel | null;
    crossPageForward: CrossPageTarget | null;
    crossPageBackward: CrossPageTarget | null;
    crossPageActive: 'forward' | 'backward' | null;
    isDragging: boolean;
  } | null>(null);
  const crossPageReadyRef = useRef<{
    forward: CrossPageTarget | null;
    backward: CrossPageTarget | null;
  }>({ forward: null, backward: null });
  const prerenderTaskCancelRef = useRef<{ forward: boolean; backward: boolean }>({ forward: false, backward: false });
  // Active cross-page commit's transitionend listener. Held in a ref so a new
  // touch interrupting the strip mid-commit can `removeEventListener` it,
  // preventing a leaked listener from firing on a later strip transition and
  // running commitNeighborSlide a second time with a stale target.
  const activeCommitListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);
  useEffect(() => { smartPanelZoomRef.current = smartPanelZoom; }, [smartPanelZoom]);
  useEffect(() => { hasPanelDataRef.current = hasPanelData; }, [hasPanelData]);
  useEffect(() => { panelDataMapRef.current = panelDataMap; }, [panelDataMap]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const writeLetterbox = useCallback((opts: {
    panel?: Panel | null;
    withTransition?: boolean;
    transformOverride?: PanelTransform;
    fadeOpacity?: 0 | 1;
    // Drag preview: lerp the rect between the current panel projected through
    // `fromTransform` and the `toPanel` projected through `toTransform`, by
    // `progress`. Overrides `transformOverride` for projection purposes.
    dragInterp?:
      | {
          kind?: 'within-page';
          fromTransform: PanelTransform;
          toPanel: Panel;
          toTransform: PanelTransform;
          progress: number;
        }
      | {
          kind: 'cross-page';
          fromPanel: Panel;
          fromTransform: PanelTransform;
          toPanel: Panel;
          toTransform: PanelTransform;
          slot: 'prev' | 'next';
          stripTranslateX: number;
          progress: number;
          // When set, the bar geometry transitions over this duration with
          // an ease-out curve — used to phase-lock the bars to the strip's
          // own transition during a cross-page slide. Unset means the bars
          // are written without a transition (per-frame drag previews).
          crossPageTransitionMs?: number;
        };
  } = {}) => {
    const group = letterboxGroupRef.current;
    if (!group) return;

    let panel = opts.panel;
    if (panel === undefined) {
      const pageData = panelDataMapRef.current.get(currentPageRef.current);
      const idx = currentPanelIndexRef.current;
      panel = pageData && pageData.pageType === 'panels' && idx >= 0 && idx < pageData.panels.length
        ? pageData.panels[idx]
        : null;
    }

    const isCrossPage = opts.dragInterp?.kind === 'cross-page';

    const gating =
      focusModeRef.current &&
      smartPanelZoomRef.current &&
      hasPanelDataRef.current &&
      isZoomedRef.current &&
      !panelZoomPausedRef.current &&
      (!letterboxFadingRef.current || isCrossPage) &&
      (panel != null || isCrossPage);

    const desiredOpacity = opts.fadeOpacity !== undefined ? opts.fadeOpacity : (gating ? 1 : 0);
    group.style.transition = 'opacity 150ms ease-out';
    group.style.opacity = String(desiredOpacity);

    if (desiredOpacity === 0 || (!panel && !isCrossPage)) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cw = parseFloat(canvas.style.width) || 0;
    const ch = parseFloat(canvas.style.height) || 0;
    if ((cw === 0 || ch === 0) && !isCrossPage) return;

    const vW = window.innerWidth;
    const vH = container.clientHeight;

    // Project a panel's padded bbox through a transform into viewport coords,
    // optionally on a non-current canvas with an extra horizontal offset.
    const projectOn = (
      p: Panel,
      t: PanelTransform,
      canvasW: number,
      canvasH: number,
      extraX: number,
    ) => {
      const mx = p.width * 0.08 * (1 - p.width);
      const my = p.height * 0.08 * (1 - p.height);
      const px = Math.max(0, p.x - mx);
      const py = Math.max(0, p.y - my);
      const pw = Math.min(1 - px, p.width + mx * 2);
      const ph = Math.min(1 - py, p.height + my * 2);
      const nLeft = (vW - canvasW) / 2;
      const nTop = (vH - canvasH) / 2;
      const txVal = t.ox * (1 - t.scale) + t.panX;
      const tyVal = t.oy * (1 - t.scale) + t.panY;
      const left = nLeft + extraX + txVal + px * canvasW * t.scale;
      const top = nTop + tyVal + py * canvasH * t.scale;
      return {
        left,
        top,
        right: left + pw * canvasW * t.scale,
        bottom: top + ph * canvasH * t.scale,
      };
    };
    const project = (p: Panel, t: PanelTransform) => projectOn(p, t, cw, ch, 0);

    // Project the padded bbox through the wrapper's transform. Using the
    // transform directly means bar rect lerp is a linear function of the
    // transform lerp — so CSS transitions on bar geometry stay in lock-step
    // with the wrapper's transform transition during panel-change animations.
    let rectLeft: number, rectTop: number, rectRight: number, rectBottom: number;
    if (opts.dragInterp?.kind === 'cross-page') {
      const di = opts.dragInterp;
      // Strip baseline is translateX(-100vw); fromCanvas is the current slot
      // (no extra offset), toCanvas is in the prev (0) or next (-200vw) slot.
      // The strip translation adds (stripTranslateX - (-vW)) to every frame.
      const stripDelta = di.stripTranslateX + vW;
      const fromExtra = stripDelta;
      const toSlotX = di.slot === 'prev' ? -vW : vW;
      const toExtra = toSlotX + stripDelta;
      const neighborCanvas = di.slot === 'prev' ? prevCanvasRef.current : nextCanvasRef.current;
      const ncw = neighborCanvas ? parseFloat(neighborCanvas.style.width) || cw : cw;
      const nch = neighborCanvas ? parseFloat(neighborCanvas.style.height) || ch : ch;
      const a = projectOn(di.fromPanel, di.fromTransform, cw, ch, fromExtra);
      const b = projectOn(di.toPanel, di.toTransform, ncw, nch, toExtra);
      const p = di.progress;
      rectLeft = a.left + (b.left - a.left) * p;
      rectTop = a.top + (b.top - a.top) * p;
      rectRight = a.right + (b.right - a.right) * p;
      rectBottom = a.bottom + (b.bottom - a.bottom) * p;
    } else if (opts.dragInterp) {
      // Drag preview: lerp between (current panel at start transform) and
      // (target panel at its target transform) by drag progress. Without this
      // lerp, projecting the current panel through the interpolated transform
      // drags the frame off-viewport and leaves the incoming panel uncovered.
      if (!panel) return;
      const a = project(panel, opts.dragInterp.fromTransform);
      const b = project(opts.dragInterp.toPanel, opts.dragInterp.toTransform);
      const p = opts.dragInterp.progress;
      rectLeft = a.left + (b.left - a.left) * p;
      rectTop = a.top + (b.top - a.top) * p;
      rectRight = a.right + (b.right - a.right) * p;
      rectBottom = a.bottom + (b.bottom - a.bottom) * p;
    } else if (panel) {
      const t: PanelTransform = opts.transformOverride ?? {
        ox: zoomOriginRef.current.x,
        oy: zoomOriginRef.current.y,
        scale: zoomScaleRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      ({ left: rectLeft, top: rectTop, right: rectRight, bottom: rectBottom } = project(panel, t));
    } else {
      return;
    }

    // Round to integer pixels after clamping — fractional edges cause the
    // browser to antialias the bar boundary, producing a see-through hairline.
    const L = Math.round(Math.max(0, Math.min(vW, rectLeft)));
    const R = Math.round(Math.max(0, Math.min(vW, rectRight)));
    const T = Math.round(Math.max(0, Math.min(vH, rectTop)));
    const B = Math.round(Math.max(0, Math.min(vH, rectBottom)));

    const crossPageMs = opts.dragInterp?.kind === 'cross-page'
      ? opts.dragInterp.crossPageTransitionMs
      : undefined;
    const barTransition = crossPageMs !== undefined
      ? `top ${crossPageMs}ms ease-out, left ${crossPageMs}ms ease-out, width ${crossPageMs}ms ease-out, height ${crossPageMs}ms ease-out`
      : opts.withTransition
        ? 'top 200ms ease-out, left 200ms ease-out, width 200ms ease-out, height 200ms ease-out'
        : 'none';

    // Skip DOM writes if geometry is identical to the last frame. Pinch-move
    // and resize frequently call this with an unchanged rect — the browser
    // still re-parses on every style assignment, so the guard matters.
    const last = lastLetterboxWriteRef.current;
    if (
      last &&
      last.L === L && last.R === R && last.T === T && last.B === B &&
      last.vW === vW && last.vH === vH && last.transition === barTransition
    ) {
      return;
    }
    lastLetterboxWriteRef.current = { L, R, T, B, vW, vH, transition: barTransition };

    // Inflate each bar 2px outward in directions where it abuts another bar
    // or the viewport edge. Hides hairline seams from sub-pixel rounding on
    // mobile (single line at the right edge, gaps at corners). The inflation
    // is purely outward — interior edges (the ones facing the framed panel)
    // stay exact so they don't crop into the panel.
    const PAD = 2;
    const bars: Array<[HTMLDivElement | null, number, number, number, number]> = [
      // Top bar: extend left, right, top (past viewport), and bottom (over the side bars' top edge).
      [letterboxTopRef.current,    -PAD,    -PAD,    vW + PAD * 2,                       T + PAD * 2],
      // Bottom bar: extend left, right, top (over side bars' bottom edge), and bottom (past viewport).
      [letterboxBottomRef.current, -PAD,    B - PAD, vW + PAD * 2,                       Math.max(0, vH - B + PAD * 2)],
      // Left bar: extend left (past viewport), top and bottom (over top/bottom bars' edges); right edge stays at L (faces panel).
      [letterboxLeftRef.current,   -PAD,    T - PAD, L + PAD,                            Math.max(0, B - T + PAD * 2)],
      // Right bar: extend right (past viewport), top and bottom; left edge stays at R (faces panel).
      [letterboxRightRef.current,  R,       T - PAD, Math.max(0, vW - R + PAD),          Math.max(0, B - T + PAD * 2)],
    ];
    for (const [el, left, top, width, height] of bars) {
      if (!el) continue;
      el.style.transition = barTransition;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  }, []);

  const handleSmartPanelZoomChange = useCallback((value: boolean) => {
    setSmartPanelZoom(value);
    smartPanelZoomRef.current = value;
    localStorage.setItem('smartPanelZoom', String(value));
    if (!value) {
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
      panelZoomPausedRef.current = false;
    } else {
      panelZoomPausedRef.current = false;
    }
    writeLetterbox({ withTransition: false });
  }, [writeLetterbox]);

  const handleFocusModeChange = useCallback((value: boolean) => {
    setFocusMode(value);
    focusModeRef.current = value;
    localStorage.setItem('focusMode', String(value));
    writeLetterbox({ withTransition: false });
  }, [writeLetterbox]);

  // Two-phase panel data fetch when smart panel zoom is enabled
  useEffect(() => {
    if (!smartPanelZoom) {
      setPanelDataMap(new Map());
      setHasPanelData(false);
      fullDataLoadedRef.current = false;
      return;
    }
    let cancelled = false;
    fullDataLoadedRef.current = false;
    fetchedPagesRef.current = new Set();

    // Phase 1: fetch current page + neighbors + 3 ahead for immediate use
    const neighbors = [currentPage - 4, currentPage - 3, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, currentPage + 3, currentPage + 4].filter(p => p >= 1);
    // Mark these pages as fetched so the on-navigate prefetch effect doesn't duplicate
    for (const p of neighbors) fetchedPagesRef.current.add(p);
    fetch(apiUrl(`/api/panel-data/${volumeId}/pages?pages=${neighbors.join(',')}`))

      .then(r => r.json())
      .then((data: { pages: PanelDataPage[] }) => {
        if (cancelled) return;
        setPanelDataMap(prev => {
          const map = new Map(prev);
          for (const page of data.pages) {
            map.set(page.pageNumber, page);
          }
          return map;
        });
        if (data.pages.length > 0) setHasPanelData(true);
      })
      .catch(() => {});

    // Phase 2: fetch full volume in background
    fetch(apiUrl(`/api/panel-data/${volumeId}`))
      .then(r => r.json())
      .then((data: PanelDataResponse) => {
        if (cancelled) return;
        const map = new Map<number, PanelDataPage>();
        for (const page of data.pages) {
          map.set(page.pageNumber, page);
        }
        setPanelDataMap(map);
        setHasPanelData(data.processedPages > 0);
        fullDataLoadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          fullDataLoadedRef.current = true;
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartPanelZoom, volumeId]);

  // Track which pages have been requested to avoid duplicate fetches
  const fetchedPagesRef = useRef(new Set<number>());

  // On-navigate prefetch: fire-and-forget fetches that don't cancel on page change
  useEffect(() => {
    if (!smartPanelZoom || fullDataLoadedRef.current) return;
    const pages = [currentPage - 4, currentPage - 3, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, currentPage + 3, currentPage + 4].filter(p => p >= 1);
    const missing = pages.filter(p => !fetchedPagesRef.current.has(p));
    if (missing.length === 0) return;
    // Mark as requested immediately to prevent duplicate fetches
    for (const p of missing) fetchedPagesRef.current.add(p);
    fetch(apiUrl(`/api/panel-data/${volumeId}/pages?pages=${missing.join(',')}`))
      .then(r => r.json())
      .then((data: { pages: PanelDataPage[] }) => {
        if (data.pages.length === 0) return;
        setPanelDataMap(prev => {
          const map = new Map(prev);
          for (const page of data.pages) {
            map.set(page.pageNumber, page);
          }
          return map;
        });
        setHasPanelData(true);
      })
      .catch(() => {
        // On failure, remove from fetched set so they can be retried
        for (const p of missing) fetchedPagesRef.current.delete(p);
      });
  // Only re-run on page change — not on panelDataMap updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, smartPanelZoom, volumeId]);

  // On page change: handle seamless cross-page transitions OR auto-zoom into panels
  useEffect(() => {
    // Case 1: Seamless cross-page transition (from advancePanel/retreatPanel strip animation).
    // Don't clear the flag here — the zoom reset effect (runs after this one)
    // needs to see it to know not to call exitZoom. It will clear the flag.
    if (autoZoomNextPageRef.current) {
      return;
    }

    // Case 2: Normal page change with smart panel zoom on.
    // Auto-zoom into the first or last panel based on navigation direction.
    // Skip if paused (user double-tapped out to full page view).
    // Skip if a strip animation is in progress — the page is about to change
    // and we don't want to re-enter zoom on the outgoing page.
    if (smartPanelZoom && !panelZoomPausedRef.current && !isZoomedRef.current && !isAnimatingRef.current) {
      const pageData = panelDataMap.get(currentPage);
      if (pageData && pageData.pageType === 'panels' && pageData.panels.length > 0) {
        const isBack = autoZoomDirectionRef.current === 'back';
        const targetIdx = isBack ? pageData.panels.length - 1 : 0;
        const panel = pageData.panels[targetIdx];
        setCurrentPanelIndex(targetIdx);
        currentPanelIndexRef.current = targetIdx;
        panelStopRef.current = 0;
        autoZoomDirectionRef.current = 'forward';
        zoomToPanelRef.current(panel, 0);
        return;
      }
    }
    // Only reset panel index if we're not zoomed (don't clobber state
    // set by zoomToPanel which may have completed between effect runs)
    if (!isZoomedRef.current) {
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, smartPanelZoom]);

  // Detect wide viewport
  useEffect(() => {
    const checkWidth = () => setIsWideViewport(window.innerWidth > 1024);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    const onResize = () => writeLetterbox({ withTransition: false });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [writeLetterbox]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = apiUrl(`/api/manga/${seriesId}/${volumeId}/pdf`);
    (async () => {
      try {
        // Polyfill Map.prototype.getOrInsertComputed (required by pdfjs-dist ≥5.5)
        // @ts-expect-error polyfill
        if (typeof Map.prototype.getOrInsertComputed === 'undefined') {
          // @ts-expect-error polyfill
          Map.prototype.getOrInsertComputed = function <K, V>(key: K, callbackfn: (key: K) => V): V {
            if (this.has(key)) return this.get(key);
            const value = callbackfn(key);
            this.set(key, value);
            return value;
          };
        }

        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        const doc = await getDocument(url).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDocument(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [seriesId, volumeId]);

  // Render a single page onto a canvas
  const renderPage = useCallback(
    async (
      doc: PDFDocumentProxy,
      pageNum: number,
      canvas: HTMLCanvasElement,
      taskRef: React.MutableRefObject<{ cancel: () => void } | null>,
      widthFraction: number = 1
    ) => {
      if (pageNum < 1 || pageNum > doc.numPages) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      if (taskRef.current) {
        taskRef.current.cancel();
        taskRef.current = null;
      }

      const page: PDFPageProxy = await doc.getPage(pageNum);
      const container = containerRef.current;
      if (!container) return;

      const dpr = window.devicePixelRatio || 1;
      const containerWidth = window.innerWidth * widthFraction;
      const containerHeight = container.clientHeight;

      const viewport = page.getViewport({ scale: 1 });
      const scaleW = containerWidth / viewport.width;
      const scaleH = containerHeight / viewport.height;
      const scale = Math.min(scaleW, scaleH) * dpr;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${scaledViewport.width / dpr}px`;
      canvas.style.height = `${scaledViewport.height / dpr}px`;

      const renderTask = page.render({ canvas, viewport: scaledViewport });
      taskRef.current = { cancel: () => renderTask.cancel() };

      try {
        await renderTask.promise;
      } catch {
        // render cancelled
      }
    },
    []
  );

  // Get direction-aware prev/next page numbers
  const getNeighborPages = useCallback((page: number) => {
    const prevPage = effectiveDirection === 'rtl' ? page + 1 : page - 1;
    const nextPage = effectiveDirection === 'rtl' ? page - 1 : page + 1;
    return { prevPage, nextPage };
  }, [effectiveDirection]);

  // Render current page(s) in paginated mode
  useEffect(() => {
    if (isVertical || !pdfDocument || !canvasRef.current) return;

    if (spreadMode && canvasRef2.current) {
      // Spread mode: render two pages side by side (unchanged behavior)
      const leftPage = effectiveDirection === 'rtl' ? currentPage + 1 : currentPage;
      const rightPage = effectiveDirection === 'rtl' ? currentPage : currentPage + 1;
      const canvas1 = canvasRef.current;
      const canvas2 = canvasRef2.current;

      if (pageRenderTimerRef.current) clearTimeout(pageRenderTimerRef.current);
      pageRenderTimerRef.current = setTimeout(() => setPageRendering(true), 150);
      const leftPromise = leftPage >= 1 && leftPage <= pdfDocument.numPages
        ? renderPage(pdfDocument, leftPage, canvas1, renderTaskRef, 0.5)
        : (canvas1.width = 0, canvas1.height = 0, Promise.resolve());
      const rightPromise = rightPage >= 1 && rightPage <= pdfDocument.numPages
        ? renderPage(pdfDocument, rightPage, canvas2, renderTaskRef2, 0.5)
        : (canvas2.width = 0, canvas2.height = 0, Promise.resolve());
      Promise.all([leftPromise, rightPromise]).then(() => {
        if (pageRenderTimerRef.current) { clearTimeout(pageRenderTimerRef.current); pageRenderTimerRef.current = null; }
        setPageRendering(false);
      });
    } else if (autoZoomNextPageRef.current) {
      // Skip normal render — canvas is already set up by strip transition or zoomToPanel.
      // Do NOT clear the flag here — the zoom-reset effect needs to see it.
      // But still render neighbor canvases at 1x so they're ready for subsequent navigation.
      // Skip any neighbor slot that was just seeded by commitNeighborSlide — overwriting it
      // here with default-fit content would desync from the matching cached transform.
      const slotIsCached = (s: 'prev' | 'next') =>
        crossPageReadyRef.current.forward?.slot === s ||
        crossPageReadyRef.current.backward?.slot === s;
      const { prevPage, nextPage } = getNeighborPages(currentPage);
      if (nextCanvasRef.current && !slotIsCached('next')) {
        renderPage(pdfDocument, nextPage, nextCanvasRef.current, nextRenderTaskRef);
      }
      setTimeout(() => {
        if (prevCanvasRef.current && pdfDocument && !slotIsCached('prev')) {
          renderPage(pdfDocument, prevPage, prevCanvasRef.current, prevRenderTaskRef);
        }
      }, 0);
    } else {
      // Single-page carousel: render current first, then neighbors
      const canvas = canvasRef.current;
      if (pageRenderTimerRef.current) clearTimeout(pageRenderTimerRef.current);
      pageRenderTimerRef.current = setTimeout(() => setPageRendering(true), 150);
      renderPage(pdfDocument, currentPage, canvas, renderTaskRef).then(() => {
        if (pageRenderTimerRef.current) { clearTimeout(pageRenderTimerRef.current); pageRenderTimerRef.current = null; }
        setPageRendering(false);
      });

      const { prevPage, nextPage } = getNeighborPages(currentPage);

      // Render next neighbor immediately after current
      if (nextCanvasRef.current) {
        renderPage(pdfDocument, nextPage, nextCanvasRef.current, nextRenderTaskRef);
      }

      // Render prev neighbor at low priority
      setTimeout(() => {
        if (prevCanvasRef.current && pdfDocument) {
          renderPage(pdfDocument, prevPage, prevCanvasRef.current, prevRenderTaskRef);
        }
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, isVertical, renderPage, getNeighborPages]);

  // Re-render paginated on resize
  useEffect(() => {
    if (isVertical) return;
    const onResize = () => {
      if (!pdfDocument || !canvasRef.current) return;
      if (spreadMode && canvasRef2.current) {
        const leftPage = effectiveDirection === 'rtl' ? currentPage + 1 : currentPage;
        const rightPage = effectiveDirection === 'rtl' ? currentPage : currentPage + 1;
        if (leftPage >= 1 && leftPage <= pdfDocument.numPages) {
          renderPage(pdfDocument, leftPage, canvasRef.current, renderTaskRef, 0.5);
        }
        if (rightPage >= 1 && rightPage <= pdfDocument.numPages && canvasRef2.current) {
          renderPage(pdfDocument, rightPage, canvasRef2.current, renderTaskRef2, 0.5);
        }
      } else {
        // Re-render all three strip canvases. Resize blows away the seeded
        // hi-res content on the neighbor canvases, so the cached cross-page
        // transforms (computed at the old vW) are no longer valid — drop them
        // and clear any committed neighbor wrapper transform so the cross-page
        // pre-render effect can rebuild the cache at the new vW on next paint.
        crossPageReadyRef.current = { forward: null, backward: null };
        for (const w of [prevZoomWrapperRef.current, nextZoomWrapperRef.current]) {
          if (w) {
            w.style.transition = 'none';
            w.style.transform = 'none';
          }
        }
        renderPage(pdfDocument, currentPage, canvasRef.current, renderTaskRef);

        const { prevPage, nextPage } = getNeighborPages(currentPage);
        if (nextCanvasRef.current) {
          renderPage(pdfDocument, nextPage, nextCanvasRef.current, nextRenderTaskRef);
        }
        if (prevCanvasRef.current) {
          renderPage(pdfDocument, prevPage, prevCanvasRef.current, prevRenderTaskRef);
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, isVertical, renderPage, getNeighborPages]);

  // Navigation helpers
  const pageStep = spreadMode ? 2 : 1;

  const goNextPage = useCallback(() => {
    setCurrentPage((p) => {
      if (p >= totalPages) {
        setVolumeOverlay('end');
        return p;
      }
      return Math.min(p + pageStep, totalPages);
    });
  }, [pageStep, totalPages]);

  const goPrevPage = useCallback(() => {
    setCurrentPage((p) => {
      if (p <= 1 && prevVolumeId) {
        setVolumeOverlay('start');
        return p;
      }
      return Math.max(p - pageStep, 1);
    });
  }, [pageStep, prevVolumeId]);

  // Write current page to localStorage immediately on every page change
  useEffect(() => {
    if (!profileId) return;
    const key = `progress:${profileId}:${volumeId}`;
    localStorage.setItem(key, String(currentPage));
  }, [profileId, volumeId, currentPage]);

  // Auto-save reading progress (debounced) and clear localStorage on success
  useEffect(() => {
    if (!profileId) return;
    const timer = setTimeout(() => {
      fetch(apiUrl('/api/progress'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, volumeId: Number(volumeId), currentPage }),
      })
        .then(() => {
          const key = `progress:${profileId}:${volumeId}`;
          localStorage.removeItem(key);
        })
        .catch((err) => console.error('Failed to save progress:', err));
    }, 5000);
    return () => clearTimeout(timer);
  }, [profileId, volumeId, currentPage]);

  // ── Carousel animation helpers ──────────────────────────────────────────

  const setStripTransform = useCallback((offsetPx: number, withTransition: boolean) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transition = withTransition ? 'transform 250ms ease-out' : 'none';
    strip.style.transform = `translateX(calc(-100vw + ${offsetPx}px))`;
  }, []);

  const commitPageChange = useCallback((direction: 'forward' | 'back') => {
    if (direction === 'forward') {
      if (effectiveDirection === 'rtl') goPrevPage();
      else goNextPage();
    } else {
      if (effectiveDirection === 'rtl') goNextPage();
      else goPrevPage();
    }
  }, [effectiveDirection, goNextPage, goPrevPage]);

  const animateStrip = useCallback((direction: 'forward' | 'back') => {
    const strip = stripRef.current;
    if (!strip || isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const targetOffset = direction === 'forward' ? -window.innerWidth : window.innerWidth;

    // Check if navigation is possible before animating
    const currentPageVal = currentPage;
    const isForwardBlocked = direction === 'forward' &&
      (effectiveDirection === 'ltr' ? currentPageVal >= totalPages : currentPageVal <= 1);
    const isBackBlocked = direction === 'back' &&
      (effectiveDirection === 'ltr' ? currentPageVal <= 1 : currentPageVal >= totalPages);

    if (isForwardBlocked || isBackBlocked) {
      // Trigger end/start overlay if relevant, then spring back.
      // In RTL, strip 'back' (swipe right) = reading forward; strip 'forward' (swipe left) = reading backward.
      // So the overlay types are flipped vs LTR.
      if (isForwardBlocked) {
        if (effectiveDirection === 'rtl') { if (prevVolumeId) setVolumeOverlay('start'); }
        else setVolumeOverlay('end');
      }
      if (isBackBlocked) {
        if (effectiveDirection === 'rtl') setVolumeOverlay('end');
        else if (prevVolumeId) setVolumeOverlay('start');
      }
      setStripTransform(0, true);
      const onEnd = () => {
        strip.removeEventListener('transitionend', onEnd);
        isAnimatingRef.current = false;
        dragOffsetRef.current = 0;
      };
      strip.addEventListener('transitionend', onEnd);
      return;
    }

    setStripTransform(targetOffset, true);

    const onTransitionEnd = () => {
      strip.removeEventListener('transitionend', onTransitionEnd);
      requestAnimationFrame(() => {
        // Before overwriting current canvas, preserve it in the neighbor slot
        // where it belongs as a neighbor of the incoming page. This prevents
        // a flash of stale content if the user navigates again before the
        // async neighbor re-render completes.
        const destCanvas = canvasRef.current;
        const sourceCanvas = direction === 'forward' ? nextCanvasRef.current : prevCanvasRef.current;
        // The old current page becomes a neighbor of the new page:
        // slide forward (left) → old current becomes the prev neighbor
        // slide back (right) → old current becomes the next neighbor
        const neighborCanvas = direction === 'forward' ? prevCanvasRef.current : nextCanvasRef.current;
        if (destCanvas && neighborCanvas && destCanvas.width > 0) {
          neighborCanvas.width = destCanvas.width;
          neighborCanvas.height = destCanvas.height;
          neighborCanvas.style.width = destCanvas.style.width;
          neighborCanvas.style.height = destCanvas.style.height;
          const nCtx = neighborCanvas.getContext('2d');
          if (nCtx) nCtx.drawImage(destCanvas, 0, 0);
        }
        // Now copy the incoming canvas into the current slot
        if (sourceCanvas && destCanvas && sourceCanvas.width > 0) {
          destCanvas.width = sourceCanvas.width;
          destCanvas.height = sourceCanvas.height;
          destCanvas.style.width = sourceCanvas.style.width;
          destCanvas.style.height = sourceCanvas.style.height;
          const ctx = destCanvas.getContext('2d');
          if (ctx) ctx.drawImage(sourceCanvas, 0, 0);
        }
        // Reset ALL zoom wrappers before snapping strip back to prevent
        // any slot from showing content through a stale zoom transform.
        for (const w of [zoomWrapperRef.current, prevZoomWrapperRef.current, nextZoomWrapperRef.current]) {
          if (w) {
            w.style.transition = 'none';
            w.style.transform = 'none';
          }
        }
        // Also reset zoom refs so the zoom reset effect doesn't exitZoom redundantly
        if (isZoomedRef.current) {
          zoomScaleRef.current = 1;
          panRef.current = { x: 0, y: 0 };
          isZoomedRef.current = false;
          setIsZoomed(false);
        }

        setStripTransform(0, false);
        commitPageChange(direction);
        isAnimatingRef.current = false;
        dragOffsetRef.current = 0;
      });
    };
    strip.addEventListener('transitionend', onTransitionEnd);
  }, [currentPage, totalPages, effectiveDirection, prevVolumeId, setStripTransform, commitPageChange]);

  const springBack = useCallback(() => {
    setStripTransform(0, true);
    const strip = stripRef.current;
    if (!strip) return;
    const onEnd = () => {
      strip.removeEventListener('transitionend', onEnd);
      isAnimatingRef.current = false;
      dragOffsetRef.current = 0;
    };
    strip.addEventListener('transitionend', onEnd);
  }, [setStripTransform]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────

  // Applies the current zoom/pan state to the wrapper div's CSS transform.
  // transform-origin: 0 0; transform: translate(tx, ty) scale(s)
  // This keeps zoomOrigin fixed on screen (tx = ox*(1-s)+panX).
  const applyZoomTransform = useCallback((withTransition: boolean) => {
    const wrapper = zoomWrapperRef.current;
    if (!wrapper) return;
    const s = zoomScaleRef.current;
    const { x: ox, y: oy } = zoomOriginRef.current;
    const { x: panX, y: panY } = panRef.current;
    wrapper.style.transition = withTransition ? 'transform 200ms ease-out' : 'none';
    wrapper.style.transformOrigin = '0 0';
    if (s === 1) {
      wrapper.style.transform = 'none';
    } else {
      const tx = ox * (1 - s) + panX;
      const ty = oy * (1 - s) + panY;
      wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }
    writeLetterbox({ withTransition });
  }, [writeLetterbox]);

  // Snapshot the wrapper's current transform from live refs. Used as the
  // `fromTransform` for cross-page drag/morph payloads so the bar morph
  // starts from any pinch the user did mid-gesture, not the stale snapshot
  // captured at touch-start.
  const liveTransform = useCallback((): PanelTransform => ({
    ox: zoomOriginRef.current.x,
    oy: zoomOriginRef.current.y,
    scale: zoomScaleRef.current,
    panX: panRef.current.x,
    panY: panRef.current.y,
  }), []);

  // Apply an interpolated transform directly to the wrapper (no ref updates).
  const applyInterpolatedTransform = useCallback((
    t: PanelTransform,
    dragInterp?: {
      fromTransform: PanelTransform;
      toPanel: Panel;
      toTransform: PanelTransform;
      progress: number;
    },
  ) => {
    const wrapper = zoomWrapperRef.current;
    if (!wrapper) return;
    wrapper.style.transition = 'none';
    wrapper.style.transformOrigin = '0 0';
    const tx = t.ox * (1 - t.scale) + t.panX;
    const ty = t.oy * (1 - t.scale) + t.panY;
    wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${t.scale})`;
    writeLetterbox({ withTransition: false, transformOverride: t, dragInterp });
  }, [writeLetterbox]);

  // Returns true if this touch is a double-tap (within 280ms and 40px of last tap).
  const detectDoubleTap = useCallback((x: number, y: number): boolean => {
    const now = Date.now();
    const last = lastTapRef.current;
    lastTapRef.current = { time: now, x, y };
    if (!last) return false;
    return now - last.time < 280 && Math.hypot(x - last.x, y - last.y) < 40;
  }, []);

  // Computes pan clamping bounds so the zoomed canvas never shows gaps at viewport edges.
  const computePanBounds = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const s = zoomScaleRef.current;
    const { x: ox, y: oy } = zoomOriginRef.current;
    const cw = parseFloat(canvas.style.width) || 0;
    const ch = parseFloat(canvas.style.height) || 0;
    const vW = window.innerWidth;
    const vH = container.clientHeight;
    // Natural (pre-transform) canvas position in viewport (centered by flexbox slot)
    const natLeft = (vW - cw) / 2;
    const natTop = (vH - ch) / 2;
    // Zoomed canvas edges on screen at panX=panY=0
    const zLeft = natLeft + ox * (1 - s);
    const zRight = zLeft + cw * s;
    const zTop = natTop + oy * (1 - s);
    const zBottom = zTop + ch * s;
    // Allow pan only as far as needed to keep canvas covering the viewport
    return {
      minX: zRight > vW ? vW - zRight : 0,
      maxX: zLeft < 0 ? -zLeft : 0,
      minY: zBottom > vH ? vH - zBottom : 0,
      maxY: zTop < 0 ? -zTop : 0,
    };
  }, []);

  // Extract midpoint and distance from a 2-finger touch list.
  const getPinchGeometry = useCallback((touches: React.TouchList) => {
    const t0 = touches[0];
    const t1 = touches[1];
    const midX = (t0.clientX + t1.clientX) / 2;
    const midY = (t0.clientY + t1.clientY) / 2;
    const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    return { mid: { x: midX, y: midY }, dist };
  }, []);

  // Re-render the current page canvas at a backing resolution appropriate for
  // the final pinch scale. Uses the same high-DPI path as zoomToPanel.
  // Debounced so rapid pinch-end → pinch-start cycles don't thrash the worker.
  const scheduleHiResRerender = useCallback((scale: number) => {
    if (pinchRerenderTimerRef.current) {
      clearTimeout(pinchRerenderTimerRef.current);
      pinchRerenderTimerRef.current = null;
    }
    pinchRerenderTimerRef.current = setTimeout(async () => {
      pinchRerenderTimerRef.current = null;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !pdfDocument) return;
      if (!isZoomedRef.current || isAnimatingRef.current) return;
      const vW = window.innerWidth;
      const vH = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const hiResScale = Math.min(Math.max(scale, 1), 4);
      try {
        const page = await pdfDocument.getPage(currentPage);
        // Guard again after await — zoom state may have changed
        if (!isZoomedRef.current || isAnimatingRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const baseScale = Math.min(vW / baseViewport.width, vH / baseViewport.height);
        const renderScale = baseScale * dpr * hiResScale;
        const hiResViewport = page.getViewport({ scale: renderScale });
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        canvas.width = hiResViewport.width;
        canvas.height = hiResViewport.height;
        canvas.style.width = `${hiResViewport.width / (dpr * hiResScale)}px`;
        canvas.style.height = `${hiResViewport.height / (dpr * hiResScale)}px`;
        const renderTask = page.render({ canvas, viewport: hiResViewport });
        renderTaskRef.current = { cancel: () => renderTask.cancel() };
        await renderTask.promise;
      } catch {
        // cancelled or failed — fine
      }
    }, 120);
  }, [pdfDocument, currentPage]);

  // Hit-test tap point against panel bounding boxes (with 15% margin).
  // Returns matched panel and its index, or null if no panel was hit.
  const hitTestPanel = useCallback((tapX: number, tapY: number): { panel: Panel; index: number } | null => {
    if (!smartPanelZoom || !hasPanelData) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Convert screen coords to normalized 0-1 page coords
    const nx = (tapX - rect.left) / rect.width;
    const ny = (tapY - rect.top) / rect.height;
    const pageData = panelDataMap.get(currentPage);
    if (!pageData || pageData.pageType !== 'panels') return null;
    for (let i = 0; i < pageData.panels.length; i++) {
      const p = pageData.panels[i];
      const mx = p.width * 0.15;
      const my = p.height * 0.15;
      if (nx >= p.x - mx && nx <= p.x + p.width + mx &&
          ny >= p.y - my && ny <= p.y + p.height + my) {
        return { panel: p, index: i };
      }
    }
    return null;
  }, [smartPanelZoom, hasPanelData, panelDataMap, currentPage]);

  const enterZoom = useCallback((tapX: number, tapY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    zoomOriginRef.current = { x: tapX - rect.left, y: tapY - rect.top };
    zoomScaleRef.current = 2.5;
    panRef.current = { x: 0, y: 0 };
    isZoomedRef.current = true;
    setIsZoomed(true);
    applyZoomTransform(true);
  }, [applyZoomTransform]);

  const exitZoom = useCallback((withTransition = true) => {
    zoomScaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    isZoomedRef.current = false;
    setIsZoomed(false);
    applyZoomTransform(withTransition);
  }, [applyZoomTransform]);

  // Reset zoom when navigating to a different page (but not during panel-zoom transitions)
  useEffect(() => {
    if (autoZoomNextPageRef.current) {
      // Panel-zoom page transition — don't exit zoom. Clear the flag.
      autoZoomNextPageRef.current = false;
      return;
    }
    if (isZoomedRef.current) exitZoom(false);
  }, [currentPage, exitZoom]);

  // Compute how many horizontal pan stops a panel needs and the appropriate zoom level.
  // Wide panels get height-fit zoom split into multiple stops; narrow panels get fitZoom (1 stop).
  const computeStopCount = useCallback((panel: Panel): { stopCount: number; zoom: number } => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { stopCount: 1, zoom: 1 };

    const vW = window.innerWidth;
    const vH = container.clientHeight;
    const cw = parseFloat(canvas.style.width) || 0;
    const ch = parseFloat(canvas.style.height) || 0;
    if (cw === 0 || ch === 0) return { stopCount: 1, zoom: 1 };

    // Adaptive margins (same as zoomToPanel)
    const marginX = panel.width * 0.08 * (1 - panel.width);
    const marginY = panel.height * 0.08 * (1 - panel.height);
    const px = Math.max(0, panel.x - marginX);
    const py = Math.max(0, panel.y - marginY);
    const pw = Math.min(1 - px, panel.width + marginX * 2);
    const ph = Math.min(1 - py, panel.height + marginY * 2);

    const pad = 0.95;
    const scaleX = (vW * pad) / (pw * cw);
    const scaleY = (vH * pad) / (ph * ch);
    const fitZoom = Math.min(scaleX, scaleY, 5);
    const heightZoom = Math.min(scaleY, 5);

    // Multi-stop triggers when the panel is dramatically wider than the viewport (ratio > 5),
    // OR when the panel is wide enough (ratio > 3) that fitZoom can't zoom in adequately (< 1.5x).
    // The second condition catches full-width panels on portrait phones where fitZoom ≈ 1.
    const panelAspect = pw / ph;
    const viewportAspect = vW / vH;
    const aspectRatio = panelAspect / viewportAspect;
    if (aspectRatio <= 5 && (fitZoom >= 1.5 || aspectRatio <= 3)) {
      return { stopCount: 1, zoom: fitZoom };
    }

    // Cap multi-stop zoom at 3.5x — full height-fit can be 7-8x for thin strips,
    // which over-zooms past readability and creates too many stops.
    const multiStopZoom = Math.min(heightZoom, 3.5);

    const panelWidthAtZoom = pw * cw * multiStopZoom;
    const overlapFactor = 0.85;
    // The first stop covers a full viewport width; each additional stop advances
    // by stride. So stops = ceil((panelWidth - vW) / stride) + 1.
    const stride = vW * overlapFactor;
    const rawStops = Math.max(1, Math.ceil((panelWidthAtZoom - vW) / stride) + 1);

    // Ensure each stop moves at least 35% of viewport width — otherwise the
    // movement feels negligible and the extra stop is wasted.
    const minStride = vW * 0.35;
    let effectiveStops = rawStops;
    while (effectiveStops > 1 && (panelWidthAtZoom - vW) / (effectiveStops - 1) < minStride) {
      effectiveStops--;
    }

    if (effectiveStops <= 1) {
      return { stopCount: 1, zoom: fitZoom };
    }

    // Allow up to 4 stops for panels where fitZoom is too low (< 1.5x),
    // otherwise cap at 3 to avoid excessive panning on moderately wide panels.
    const maxStops = fitZoom < 1.5 ? 4 : 3;
    const stops = Math.min(effectiveStops, maxStops);
    if (rawStops > maxStops) {
      // N stops cover (N-1)*stride + vW pixels total
      const reducedZoom = ((maxStops - 1) * stride + vW) / (pw * cw);
      return { stopCount: maxStops, zoom: Math.min(reducedZoom, 3.5) };
    }

    return { stopCount: stops, zoom: multiStopZoom };
  }, []);

  // Compute the panX value for each stop of a multi-stop panel.
  // Returns array of panX values indexed by stop, using current canvas/zoom state.
  const computeStopPanPositions = useCallback((panel: Panel): number[] => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return [panRef.current.x];

    const vW = window.innerWidth;
    const vH = container.clientHeight;
    const cw = parseFloat(canvas.style.width) || 0;
    const ch = parseFloat(canvas.style.height) || 0;
    if (cw === 0 || ch === 0) return [panRef.current.x];

    const s = zoomScaleRef.current;
    const ox = zoomOriginRef.current.x;
    const natLeft = (vW - cw) / 2;
    const natTop = (vH - ch) / 2;

    const marginX = panel.width * 0.08 * (1 - panel.width);
    const marginY = panel.height * 0.08 * (1 - panel.height);
    const px = Math.max(0, panel.x - marginX);
    const py = Math.max(0, panel.y - marginY);
    const pw = Math.min(1 - px, panel.width + marginX * 2);
    const ph = Math.min(1 - py, panel.height + marginY * 2);

    const { stopCount } = computeStopCount(panel);

    if (stopCount <= 1) {
      // Single-stop: compute the centered position
      const panelCx = (px + pw / 2) * cw;
      const panelCy = (py + ph / 2) * ch;
      const centerPanX = vW / 2 - natLeft - panelCx;
      const centerPanY = vH / 2 - natTop - panelCy;
      // The single-stop position uses the same formula as zoomToPanel's single-stop branch
      return [centerPanX];
    }

    const panelLeftCss = px * cw;
    const panelWidthZoomed = pw * cw * s;
    // Distribute stops evenly: first covers the panel's left edge, last covers
    // the right edge, middles are evenly spaced. This matches the minStride
    // check in computeStopCount (which assumes uniform spacing) and avoids
    // the tiny last-transition that a fixed-stride + clamp approach produced
    // when panelWidthZoomed was just barely over (stopCount-1)*fixedStride.
    const uniformStride = (panelWidthZoomed - vW) / (stopCount - 1);

    const positions: number[] = [];
    for (let i = 0; i < stopCount; i++) {
      const effStop = effectiveDirection === 'rtl' ? (stopCount - 1 - i) : i;
      const stopCenterX = effStop * uniformStride + vW / 2;
      const canvasCenterX = panelLeftCss + stopCenterX / s;
      const panX = vW / 2 - natLeft - ox * (1 - s) - canvasCenterX * s;
      positions.push(panX);
    }
    return positions;
  }, [computeStopCount, effectiveDirection]);

  // Compute transform params for a panel/stop using current canvas dims (no re-render).
  const computePanelTransform = useCallback((panel: Panel, stopIndex: number): PanelTransform | null => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const vW = window.innerWidth;
    const vH = container.clientHeight;
    const cw = parseFloat(canvas.style.width) || 0;
    const ch = parseFloat(canvas.style.height) || 0;
    if (cw === 0 || ch === 0) return null;

    const marginX = panel.width * 0.08 * (1 - panel.width);
    const marginY = panel.height * 0.08 * (1 - panel.height);
    const px = Math.max(0, panel.x - marginX);
    const py = Math.max(0, panel.y - marginY);
    const pw = Math.min(1 - px, panel.width + marginX * 2);
    const ph = Math.min(1 - py, panel.height + marginY * 2);

    const pad = 0.95;
    const scaleX = (vW * pad) / (pw * cw);
    const scaleY = (vH * pad) / (ph * ch);
    const fitZoom = Math.min(scaleX, scaleY, 5);
    const heightZoom = Math.min(scaleY, 5);
    const overlapFactor = 0.85;

    const panelAspect = pw / ph;
    const viewportAspect = vW / vH;
    let finalZoom: number;
    let finalStopCount: number;

    const aspectRatio = panelAspect / viewportAspect;
    if (aspectRatio <= 5 && (fitZoom >= 1.5 || aspectRatio <= 3)) {
      finalZoom = fitZoom;
      finalStopCount = 1;
    } else {
      const multiZoom = Math.min(heightZoom, 3.5);
      const panelWidthAtZoom = pw * cw * multiZoom;
      const stride = vW * overlapFactor;
      const rawStops = Math.max(1, Math.ceil((panelWidthAtZoom - vW) / stride) + 1);
      const minStride = vW * 0.35;
      let effStops = rawStops;
      while (effStops > 1 && (panelWidthAtZoom - vW) / (effStops - 1) < minStride) effStops--;
      const maxStops = fitZoom < 1.5 ? 4 : 3;
      if (effStops <= 1) { finalZoom = fitZoom; finalStopCount = 1; }
      else if (effStops <= maxStops) { finalZoom = multiZoom; finalStopCount = effStops; }
      else { finalStopCount = maxStops; finalZoom = Math.min(((maxStops - 1) * stride + vW) / (pw * cw), 3.5); }
    }

    const natLeft = (vW - cw) / 2;
    const natTop = (vH - ch) / 2;
    const ox = (px + pw / 2) * cw;
    const oy = (py + ph / 2) * ch;

    if (finalStopCount <= 1) {
      return { ox, oy, scale: finalZoom, panX: vW / 2 - natLeft - ox, panY: vH / 2 - natTop - oy };
    }

    // Multi-stop: distribute stops evenly across the panel width.
    const panelLeftCss = px * cw;
    const panelWidthZoomed = pw * cw * finalZoom;
    const uniformStride = (panelWidthZoomed - vW) / (finalStopCount - 1);
    const panelCenterY = oy;
    const effectiveStop = effectiveDirection === 'rtl' ? (finalStopCount - 1 - stopIndex) : stopIndex;
    const stopCenterX = effectiveStop * uniformStride + vW / 2;
    const canvasCenterX = panelLeftCss + stopCenterX / finalZoom;
    const panX = vW / 2 - natLeft - ox * (1 - finalZoom) - canvasCenterX * finalZoom;
    const panY = vH / 2 - natTop - oy * (1 - finalZoom) - panelCenterY * finalZoom;
    return { ox, oy, scale: finalZoom, panX, panY };
  }, [effectiveDirection]);

  // Apply the target panel transform immediately (so the 200ms transition starts
  // on the next frame), then defer the hi-res re-render until after the
  // transition plays. The canvas CSS dims are invariant across hi-res scales
  // (pageWidth * baseScale), so the running animation lands on the correct
  // position regardless of when — or whether — the re-render has completed.
  // Without this split, a fast flick has to wait on the async render before
  // the transform starts, producing jitter on the next-panel transition.
  const zoomToPanel = useCallback(async (panel: Panel, stopIndex: number = 0) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !pdfDocument) return;

    const target = computePanelTransform(panel, stopIndex);
    if (!target) return;

    zoomOriginRef.current = { x: target.ox, y: target.oy };
    zoomScaleRef.current = target.scale;
    panRef.current = { x: target.panX, y: target.panY };
    isZoomedRef.current = true;
    setIsZoomed(true);
    applyZoomTransform(true);

    // Defer hi-res re-render until after the 200ms transform transition so the
    // canvas.width = ... clear doesn't blank the backing buffer mid-animation.
    if (panelRerenderTimerRef.current) {
      clearTimeout(panelRerenderTimerRef.current);
      panelRerenderTimerRef.current = null;
    }
    const renderPageNum = currentPage;
    panelRerenderTimerRef.current = setTimeout(async () => {
      panelRerenderTimerRef.current = null;
      const liveCanvas = canvasRef.current;
      const liveContainer = containerRef.current;
      if (!liveCanvas || !liveContainer || !pdfDocument) return;
      if (!isZoomedRef.current || currentPageRef.current !== renderPageNum) return;

      const vW = window.innerWidth;
      const vH = liveContainer.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const hiResScale = Math.min(target.scale, 4);
      try {
        const page = await pdfDocument.getPage(renderPageNum);
        if (!isZoomedRef.current || currentPageRef.current !== renderPageNum) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const baseScale = Math.min(vW / baseViewport.width, vH / baseViewport.height);
        const renderScale = baseScale * dpr * hiResScale;
        const hiResViewport = page.getViewport({ scale: renderScale });

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        liveCanvas.width = hiResViewport.width;
        liveCanvas.height = hiResViewport.height;
        liveCanvas.style.width = `${hiResViewport.width / (dpr * hiResScale)}px`;
        liveCanvas.style.height = `${hiResViewport.height / (dpr * hiResScale)}px`;
        const renderTask = page.render({ canvas: liveCanvas, viewport: hiResViewport });
        renderTaskRef.current = { cancel: () => renderTask.cancel() };
        await renderTask.promise;
      } catch {
        /* cancelled */
      }
    }, 220);
  }, [applyZoomTransform, pdfDocument, currentPage, computePanelTransform]);

  zoomToPanelRef.current = zoomToPanel;

  // Reading direction → carousel slot mapping.
  // Forward: RTL slides from left (prev slot), LTR from right (next slot). Back: reversed.
  const pickSlot = useCallback((readingDir: 'forward' | 'back') => {
    const slot: 'prev' | 'next' = readingDir === 'forward'
      ? (effectiveDirection === 'rtl' ? 'prev' : 'next')
      : (effectiveDirection === 'rtl' ? 'next' : 'prev');
    const targetCanvas = slot === 'prev' ? prevCanvasRef.current : nextCanvasRef.current;
    const targetWrapper = slot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;
    const targetRenderTaskRef = slot === 'prev' ? prevRenderTaskRef : nextRenderTaskRef;
    const slideTarget = slot === 'prev' ? 'translateX(0)' : 'translateX(-200vw)';
    return { slot, targetCanvas, targetWrapper, targetRenderTaskRef, slideTarget };
  }, [effectiveDirection]);

  interface PrerenderResult {
    transform: PanelTransform;
    panelIndex: number;
    resolvedStopIndex: number;
  }

  // Render `targetPageNum` zoomed to `targetPanel` into the chosen slot's canvas
  // and apply the matching transform to its wrapper. Returns the computed
  // transform + resolved stop index, or null if pre-conditions failed / render
  // was cancelled.
  const prerenderNeighbor = useCallback(async (
    targetPageNum: number,
    targetPanel: Panel,
    targetPanelIndex: number,
    targetStopIndex: number,
    slot: 'prev' | 'next',
  ): Promise<PrerenderResult | null> => {
    const container = containerRef.current;
    const targetCanvas = slot === 'prev' ? prevCanvasRef.current : nextCanvasRef.current;
    const targetWrapper = slot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;
    const targetRenderTaskRef = slot === 'prev' ? prevRenderTaskRef : nextRenderTaskRef;
    if (!container || !targetCanvas || !targetWrapper || !pdfDocument) return null;

    const vW = window.innerWidth;
    const vH = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const marginX = targetPanel.width * 0.08 * (1 - targetPanel.width);
    const marginY = targetPanel.height * 0.08 * (1 - targetPanel.height);
    const px = Math.max(0, targetPanel.x - marginX);
    const py = Math.max(0, targetPanel.y - marginY);
    const pw = Math.min(1 - px, targetPanel.width + marginX * 2);
    const ph = Math.min(1 - py, targetPanel.height + marginY * 2);

    const page = await pdfDocument.getPage(targetPageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const baseScale = Math.min(vW / baseViewport.width, vH / baseViewport.height);

    const pad = 0.95;
    const cssCw = baseViewport.width * baseScale;
    const cssCh = baseViewport.height * baseScale;
    const scaleXVal = (vW * pad) / (pw * cssCw);
    const scaleYVal = (vH * pad) / (ph * cssCh);
    const fitZoom = Math.min(scaleXVal, scaleYVal, 5);
    const heightZoom = Math.min(scaleYVal, 5);

    const overlapFactor = 0.85;
    const panelAspect = pw / ph;
    const viewportAspect = vW / vH;
    const aspectRatio = panelAspect / viewportAspect;
    let preZoom: number;
    if (aspectRatio <= 5 && (fitZoom >= 1.5 || aspectRatio <= 3)) {
      preZoom = fitZoom;
    } else {
      const multiZoom = Math.min(heightZoom, 3.5);
      const pWidthAtZoom = pw * cssCw * multiZoom;
      const stride = vW * overlapFactor;
      const rawStops = Math.max(1, Math.ceil((pWidthAtZoom - vW) / stride) + 1);
      const minStride = vW * 0.35;
      let effStops = rawStops;
      while (effStops > 1 && (pWidthAtZoom - vW) / (effStops - 1) < minStride) effStops--;
      const maxStops = fitZoom < 1.5 ? 4 : 3;
      if (effStops <= 1) { preZoom = fitZoom; }
      else if (effStops <= maxStops) { preZoom = multiZoom; }
      else { preZoom = Math.min(((maxStops - 1) * stride + vW) / (pw * cssCw), 3.5); }
    }

    const hiResScale = Math.min(preZoom, 4);
    const renderScale = baseScale * dpr * hiResScale;
    const hiResViewport = page.getViewport({ scale: renderScale });

    targetCanvas.width = hiResViewport.width;
    targetCanvas.height = hiResViewport.height;
    targetCanvas.style.width = `${hiResViewport.width / (dpr * hiResScale)}px`;
    targetCanvas.style.height = `${hiResViewport.height / (dpr * hiResScale)}px`;

    if (targetRenderTaskRef.current) {
      targetRenderTaskRef.current.cancel();
      targetRenderTaskRef.current = null;
    }
    const renderTask = page.render({ canvas: targetCanvas, viewport: hiResViewport });
    targetRenderTaskRef.current = { cancel: () => renderTask.cancel() };
    try { await renderTask.promise; } catch { return null; }

    const newCw = parseFloat(targetCanvas.style.width);
    const newCh = parseFloat(targetCanvas.style.height);
    const ox = (px + pw / 2) * newCw;
    const oy = (py + ph / 2) * newCh;

    const fScaleX = (vW * pad) / (pw * newCw);
    const fScaleY = (vH * pad) / (ph * newCh);
    const fFitZoom = Math.min(fScaleX, fScaleY, 5);
    const fHeightZoom = Math.min(fScaleY, 5);
    let fZoom: number;
    let fStopCount: number;
    const fAspectRatio = (pw / ph) / (vW / vH);
    if (fAspectRatio <= 5 && (fFitZoom >= 1.5 || fAspectRatio <= 3)) {
      fZoom = fFitZoom; fStopCount = 1;
    } else {
      const fMultiZoom = Math.min(fHeightZoom, 3.5);
      const fPanelWidthAtZoom = pw * newCw * fMultiZoom;
      const fStride = vW * overlapFactor;
      const fRawStops = Math.max(1, Math.ceil((fPanelWidthAtZoom - vW) / fStride) + 1);
      const fMinStride = vW * 0.35;
      let fEffStops = fRawStops;
      while (fEffStops > 1 && (fPanelWidthAtZoom - vW) / (fEffStops - 1) < fMinStride) fEffStops--;
      const fMaxStops = fFitZoom < 1.5 ? 4 : 3;
      if (fEffStops <= 1) { fZoom = fFitZoom; fStopCount = 1; }
      else if (fEffStops <= fMaxStops) { fZoom = fMultiZoom; fStopCount = fEffStops; }
      else { fStopCount = fMaxStops; fZoom = Math.min(((fMaxStops - 1) * fStride + vW) / (pw * newCw), 3.5); }
    }

    const natLeft = (vW - newCw) / 2;
    const natTop = (vH - newCh) / 2;

    const resolvedStopIndex = targetStopIndex < 0 ? fStopCount - 1 : targetStopIndex;

    let panX: number, panY: number;
    if (fStopCount <= 1) {
      panX = vW / 2 - natLeft - ox;
      panY = vH / 2 - natTop - oy;
    } else {
      const panelLeftCss = px * newCw;
      const panelCenterY = (py + ph / 2) * newCh;
      const panelWidthZoomed = pw * newCw * fZoom;
      const uniformStride = (panelWidthZoomed - vW) / (fStopCount - 1);
      const effectiveStop = effectiveDirection === 'rtl' ? (fStopCount - 1 - resolvedStopIndex) : resolvedStopIndex;
      const stopCenterX = effectiveStop * uniformStride + vW / 2;
      const canvasCenterX = panelLeftCss + stopCenterX / fZoom;
      panX = vW / 2 - natLeft - ox * (1 - fZoom) - canvasCenterX * fZoom;
      panY = vH / 2 - natTop - oy * (1 - fZoom) - panelCenterY * fZoom;
    }

    const tx = ox * (1 - fZoom) + panX;
    const ty = oy * (1 - fZoom) + panY;

    targetWrapper.style.transition = 'none';
    targetWrapper.style.transformOrigin = '0 0';
    targetWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${fZoom})`;

    return {
      transform: { ox, oy, scale: fZoom, panX, panY },
      panelIndex: targetPanelIndex,
      resolvedStopIndex,
    };
  }, [effectiveDirection, pdfDocument]);

  // Post-strip-slide cleanup: copy neighbor canvas/transform into current,
  // snap strip back, sync zoom refs, commit page change, re-apply transform.
  const commitNeighborSlide = useCallback((opts: {
    targetPageNum: number;
    targetPanelIndex: number;
    resolvedStopIndex: number;
    transform: PanelTransform;
    slot: 'prev' | 'next';
    readingDir: 'forward' | 'back';
  }) => {
    const strip = stripRef.current;
    const targetCanvas = opts.slot === 'prev' ? prevCanvasRef.current : nextCanvasRef.current;
    const targetWrapper = opts.slot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;
    if (!strip) return;

    const { ox, oy, scale: fZoom, panX, panY } = opts.transform;
    const tx = ox * (1 - fZoom) + panX;
    const ty = oy * (1 - fZoom) + panY;

    // Capture the OLD page's state before we overwrite anything. We'll use
    // it below to seed the opposite slot so an immediate yo-yo back to where
    // we came from has a live preview without waiting on a new pre-render.
    const oldPageNum = currentPageRef.current;
    const oldPanelIndex = currentPanelIndexRef.current;
    const oldStopIndex = panelStopRef.current;
    const oldTransform: PanelTransform = {
      ox: zoomOriginRef.current.x,
      oy: zoomOriginRef.current.y,
      scale: zoomScaleRef.current,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    const oldPageData = panelDataMapRef.current.get(oldPageNum);
    const oldPanel = oldPageData?.pageType === 'panels'
      && oldPanelIndex >= 0 && oldPanelIndex < oldPageData.panels.length
        ? oldPageData.panels[oldPanelIndex]
        : null;

    const oppositeSlot: 'prev' | 'next' = opts.slot === 'prev' ? 'next' : 'prev';
    const oppositeCanvas = oppositeSlot === 'prev' ? prevCanvasRef.current : nextCanvasRef.current;
    const oppositeWrapper = oppositeSlot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;

    const destCanvas = canvasRef.current;
    const destWrapper = zoomWrapperRef.current;

    // Preserve the outgoing page into the opposite slot BEFORE we overwrite
    // destCanvas. Both the canvas content and the wrapper transform are
    // valid for an immediate reverse-direction cross-page drag.
    if (destCanvas && destCanvas.width > 0 && oppositeCanvas) {
      oppositeCanvas.width = destCanvas.width;
      oppositeCanvas.height = destCanvas.height;
      oppositeCanvas.style.width = destCanvas.style.width;
      oppositeCanvas.style.height = destCanvas.style.height;
      const oCtx = oppositeCanvas.getContext('2d');
      if (oCtx) oCtx.drawImage(destCanvas, 0, 0);
    }
    if (oppositeWrapper && oldPanel) {
      const oldTx = oldTransform.ox * (1 - oldTransform.scale) + oldTransform.panX;
      const oldTy = oldTransform.oy * (1 - oldTransform.scale) + oldTransform.panY;
      oppositeWrapper.style.transition = 'none';
      oppositeWrapper.style.transformOrigin = '0 0';
      oppositeWrapper.style.transform = `translate(${oldTx}px, ${oldTy}px) scale(${oldTransform.scale})`;
    }

    if (destCanvas && destWrapper && targetCanvas) {
      destCanvas.width = targetCanvas.width;
      destCanvas.height = targetCanvas.height;
      destCanvas.style.width = targetCanvas.style.width;
      destCanvas.style.height = targetCanvas.style.height;
      const ctx = destCanvas.getContext('2d');
      if (ctx) ctx.drawImage(targetCanvas, 0, 0);

      destWrapper.style.transition = 'none';
      destWrapper.style.transformOrigin = '0 0';
      destWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${fZoom})`;
    }

    if (targetWrapper) targetWrapper.style.transform = 'none';

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(-100vw)';

    zoomOriginRef.current = { x: ox, y: oy };
    zoomScaleRef.current = fZoom;
    panRef.current = { x: panX, y: panY };
    isZoomedRef.current = true;
    setIsZoomed(true);

    autoZoomNextPageRef.current = true;
    setCurrentPanelIndex(opts.targetPanelIndex);
    currentPanelIndexRef.current = opts.targetPanelIndex;
    panelStopRef.current = opts.resolvedStopIndex;
    if (opts.readingDir === 'forward') goNextPage();
    else goPrevPage();
    // Sync currentPageRef synchronously so writeLetterbox (called in the
    // rAF below, before React's commit re-runs our useEffect sync) looks
    // up the new page's panel data, not the old page's.
    currentPageRef.current = opts.targetPageNum;

    // Seed the cross-page-ready entry for the OPPOSITE direction (back to
    // the page we just left) using the old page state we captured above.
    // The neighbor canvas + wrapper are already in place from the copy
    // above, so this is a fully-formed cache hit — a yo-yo back gesture
    // engages the live preview immediately, no re-render needed.
    if (oldPanel) {
      const oppositeKey: 'forward' | 'backward' = opts.readingDir === 'forward' ? 'backward' : 'forward';
      const oppositeReadingDir: 'forward' | 'back' = opts.readingDir === 'forward' ? 'back' : 'forward';
      crossPageReadyRef.current[oppositeKey] = {
        pageNum: oldPageNum,
        slot: oppositeSlot,
        panel: oldPanel,
        panelIndex: oldPanelIndex,
        stopIndex: oldStopIndex,
        transform: oldTransform,
        readingDir: oppositeReadingDir,
      };
    }

    requestAnimationFrame(() => {
      letterboxFadingRef.current = false;
      applyZoomTransform(false);
    });
  }, [goNextPage, goPrevPage, applyZoomTransform]);

  // Shared helper: pre-render a page zoomed to a specific panel on a carousel slot,
  // then slide the strip to reveal it. Used by advancePanel and retreatPanel for
  // cross-page transitions (panel→panel, non-panel→panel).
  const slideToZoomedPage = useCallback((
    targetPageNum: number,
    targetPanel: Panel,
    targetPanelIndex: number,
    targetStopIndex: number,
    readingDir: 'forward' | 'back',
  ): boolean => {
    const SLIDE_MS = 250;
    const strip = stripRef.current;
    const container = containerRef.current;
    const { slot, targetCanvas, targetWrapper, slideTarget } = pickSlot(readingDir);

    if (!targetCanvas || !targetWrapper || !strip || !container || !pdfDocument) {
      return false;
    }

    // Capture from-state for the cross-page letterbox morph (matches the
    // touch drag's live preview) so keyboard/wheel/tap navigation gets the
    // same continuous frame transition rather than a fade-out/fade-in.
    const fromPageData = panelDataMapRef.current.get(currentPageRef.current);
    const fromIdx = currentPanelIndexRef.current;
    const fromPanel = fromPageData?.pageType === 'panels'
      && fromIdx >= 0 && fromIdx < fromPageData.panels.length
        ? fromPageData.panels[fromIdx]
        : null;
    const fromTransform: PanelTransform = {
      ox: zoomOriginRef.current.x,
      oy: zoomOriginRef.current.y,
      scale: zoomScaleRef.current,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };

    // Suppress writeLetterbox's default panel-rect path during the slide —
    // the cross-page morph branch below bypasses this gate.
    letterboxFadingRef.current = true;

    const vW = window.innerWidth;
    const slotEndX = slot === 'prev' ? 0 : -2 * vW;

    const startSlide = (resTransform: PanelTransform, resPanelIndex: number, resStopIndex: number) => {
      strip.style.transition = `transform ${SLIDE_MS}ms ease-out`;
      strip.style.transform = slideTarget;

      const canMorph = fromPanel != null
        && focusModeRef.current
        && smartPanelZoomRef.current
        && hasPanelDataRef.current
        && isZoomedRef.current;
      if (canMorph) {
        // Anchor the bars at the from-rect with no transition, force a
        // synchronous layout flush so the browser commits that style as a
        // distinct state, then write the destination rect with a CSS
        // transition matching the strip's duration and ease-out curve. The
        // browser interpolates the four bar geometry properties over
        // SLIDE_MS — phase-locked to the strip because both use the same
        // curve. The forced reflow is required: without it, two writes in
        // the same JS tick coalesce into one style change event and the
        // transition would start from whatever the bars were at before the
        // slide (possibly mid-transition from a prior write), not from the
        // anchored from-rect.
        writeLetterbox({
          dragInterp: {
            kind: 'cross-page',
            fromPanel: fromPanel as Panel,
            fromTransform,
            toPanel: targetPanel,
            toTransform: resTransform,
            slot,
            stripTranslateX: -vW,
            progress: 0,
          },
        });
        const group = letterboxGroupRef.current;
        if (group) void group.offsetHeight;
        writeLetterbox({
          dragInterp: {
            kind: 'cross-page',
            fromPanel: fromPanel as Panel,
            fromTransform,
            toPanel: targetPanel,
            toTransform: resTransform,
            slot,
            stripTranslateX: slotEndX,
            progress: 1,
            crossPageTransitionMs: SLIDE_MS,
          },
        });
      }

      const onSlideEnd = () => {
        strip.removeEventListener('transitionend', onSlideEnd);
        commitNeighborSlide({
          targetPageNum,
          targetPanelIndex: resPanelIndex,
          resolvedStopIndex: resStopIndex,
          transform: resTransform,
          slot,
          readingDir,
        });
      };
      strip.addEventListener('transitionend', onSlideEnd);
    };

    // If the eager pre-render has already produced a matching cache entry
    // (boundary panel pre-render or yo-yo opposite-slot seed), reuse the
    // already-rendered canvas + transform and skip the await.
    const cacheKey: 'forward' | 'backward' = readingDir === 'forward' ? 'forward' : 'backward';
    const cached = crossPageReadyRef.current[cacheKey];
    const cacheValid = cached !== null
      && cached.pageNum === targetPageNum
      && cached.panelIndex === targetPanelIndex
      && cached.slot === slot;

    if (cacheValid && cached) {
      startSlide(cached.transform, cached.panelIndex, cached.stopIndex);
    } else {
      (async () => {
        const result = await prerenderNeighbor(targetPageNum, targetPanel, targetPanelIndex, targetStopIndex, slot);
        if (!result) return;
        startSlide(result.transform, result.panelIndex, result.resolvedStopIndex);
      })();
    }

    return true;
  }, [pdfDocument, pickSlot, prerenderNeighbor, commitNeighborSlide, writeLetterbox]);

  // Pre-render the neighbor page when zoomed onto a boundary panel of the
  // current page. This lets a subsequent cross-page touch drag preview the
  // neighbor instantly instead of waiting on the render at gesture start.
  useEffect(() => {
    if (!isZoomed || !smartPanelZoom || !hasPanelData || isVertical || spreadMode || !pdfDocument) {
      crossPageReadyRef.current = { forward: null, backward: null };
      return;
    }
    const pageData = panelDataMap.get(currentPage);
    if (!pageData || pageData.pageType !== 'panels' || pageData.panels.length === 0) {
      crossPageReadyRef.current = { forward: null, backward: null };
      return;
    }
    if (currentPanelIndex < 0 || currentPanelIndex >= pageData.panels.length) {
      crossPageReadyRef.current = { forward: null, backward: null };
      return;
    }
    // Eagerly pre-render BOTH neighbors as soon as the user is zoomed on any
    // panel of the current page — not just the boundary. The render takes
    // 100–400 ms; gating on the boundary panel meant the user often reached
    // the edge before the render finished, falling back to rubber-band.
    // Pre-rendering on entry trades one extra background render for a
    // reliable live preview when the user actually crosses the boundary.
    const isLastPanel = true;
    const isFirstPanel = true;

    let cancelled = false;
    prerenderTaskCancelRef.current = { forward: false, backward: false };

    const forwardSlot = pickSlot('forward').slot;
    const backwardSlot = pickSlot('back').slot;

    const nextPageNum = currentPage + 1;
    const prevPageNum = currentPage - 1;
    const nextPageData = panelDataMap.get(nextPageNum);
    const prevPageData = panelDataMap.get(prevPageNum);
    const nextFirstPanel = isLastPanel
      && nextPageNum <= pdfDocument.numPages
      && nextPageData?.pageType === 'panels'
      && nextPageData.panels.length > 0
        ? nextPageData.panels[0]
        : null;
    const prevLastPanel = isFirstPanel
      && prevPageNum >= 1
      && prevPageData?.pageType === 'panels'
      && prevPageData.panels.length > 0
        ? prevPageData.panels[prevPageData.panels.length - 1]
        : null;

    if (!nextFirstPanel) {
      crossPageReadyRef.current.forward = null;
      const w = forwardSlot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;
      if (w) { w.style.transition = 'none'; w.style.transform = 'none'; }
    }
    if (!prevLastPanel) {
      crossPageReadyRef.current.backward = null;
      const w = backwardSlot === 'prev' ? prevZoomWrapperRef.current : nextZoomWrapperRef.current;
      if (w) { w.style.transition = 'none'; w.style.transform = 'none'; }
    }

    if (nextFirstPanel) {
      const cached = crossPageReadyRef.current.forward;
      const cacheValid = cached !== null
        && cached.pageNum === nextPageNum
        && cached.panelIndex === 0
        && cached.slot === forwardSlot;
      if (!cacheValid) {
        crossPageReadyRef.current.forward = null;
        (async () => {
          const result = await prerenderNeighbor(nextPageNum, nextFirstPanel, 0, 0, forwardSlot);
          if (cancelled || prerenderTaskCancelRef.current.forward) return;
          if (!result) return;
          crossPageReadyRef.current.forward = {
            pageNum: nextPageNum,
            slot: forwardSlot,
            panel: nextFirstPanel,
            panelIndex: result.panelIndex,
            stopIndex: result.resolvedStopIndex,
            transform: result.transform,
            readingDir: 'forward',
          };
        })();
      }
    }

    if (prevLastPanel) {
      const lastIndex = (prevPageData?.panels.length ?? 1) - 1;
      const cached = crossPageReadyRef.current.backward;
      const cacheValid = cached !== null
        && cached.pageNum === prevPageNum
        && cached.panelIndex === lastIndex
        && cached.slot === backwardSlot;
      if (!cacheValid) {
        crossPageReadyRef.current.backward = null;
        (async () => {
          const result = await prerenderNeighbor(prevPageNum, prevLastPanel, lastIndex, -1, backwardSlot);
          if (cancelled || prerenderTaskCancelRef.current.backward) return;
          if (!result) return;
          crossPageReadyRef.current.backward = {
            pageNum: prevPageNum,
            slot: backwardSlot,
            panel: prevLastPanel,
            panelIndex: result.panelIndex,
            stopIndex: result.resolvedStopIndex,
            transform: result.transform,
            readingDir: 'back',
          };
        })();
      }
    }

    return () => {
      cancelled = true;
      prerenderTaskCancelRef.current = { forward: true, backward: true };
      if (prevRenderTaskRef.current) {
        prevRenderTaskRef.current.cancel();
        prevRenderTaskRef.current = null;
      }
      if (nextRenderTaskRef.current) {
        nextRenderTaskRef.current.cancel();
        nextRenderTaskRef.current = null;
      }
    };
  }, [currentPage, currentPanelIndex, panelStopTick, isZoomed, smartPanelZoom, hasPanelData,
      panelDataMap, pdfDocument, isVertical, spreadMode, pickSlot, prerenderNeighbor]);

  // Navigate to next panel (returns true if handled)
  const advancePanel = useCallback((): boolean => {
    if (!smartPanelZoom || !hasPanelData) return false;

    const pageData = panelDataMap.get(currentPage);
    const hasCurrentPanels = pageData && pageData.pageType === 'panels' && pageData.panels.length > 0;

    if (hasCurrentPanels) {
      // If not zoomed, always start from -1 so the first interaction enters panel 0.
      const curIdx = isZoomedRef.current ? currentPanelIndexRef.current : -1;
      if (curIdx >= 0 && curIdx < pageData.panels.length) {
        const curPanel = pageData.panels[curIdx];
        const { stopCount } = computeStopCount(curPanel);
        if (panelStopRef.current < stopCount - 1) {
          panelStopRef.current++;
          setPanelStopTick(t => t + 1);
          zoomToPanel(curPanel, panelStopRef.current);
          return true;
        }
      }

      const nextIndex = curIdx + 1;

      if (nextIndex < pageData.panels.length) {
        setCurrentPanelIndex(nextIndex);
        currentPanelIndexRef.current = nextIndex;
        panelStopRef.current = 0;
        zoomToPanel(pageData.panels[nextIndex], 0);
        return true;
      }
    }

    // All panels visited (or current page has no panels) — try cross-page transition
    const nextPageNum = currentPage + 1;
    if (!pdfDocument || nextPageNum > pdfDocument.numPages) {
      // No next page — fall through to normal page turn (end of volume)
      if (isZoomedRef.current) exitZoom(true);
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
      return false;
    }

    const nextPageData = panelDataMap.get(nextPageNum);
    const nextPanel = nextPageData?.pageType === 'panels' && nextPageData.panels.length > 0
      ? nextPageData.panels[0] : null;

    if (!nextPanel) {
      // Next page has no panels — exit zoom and fall through to animateStrip
      if (isZoomedRef.current) exitZoom(true);
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
      return false;
    }

    // Pre-render next page zoomed to first panel and slide in
    return slideToZoomedPage(nextPageNum, nextPanel, 0, 0, 'forward');
  }, [smartPanelZoom, hasPanelData, panelDataMap, currentPage, zoomToPanel, exitZoom, pdfDocument, computeStopCount, slideToZoomedPage]);

  // Navigate to previous panel (returns true if handled)
  const retreatPanel = useCallback((): boolean => {
    if (!smartPanelZoom || !hasPanelData) return false;

    const pageData = panelDataMap.get(currentPage);
    const hasCurrentPanels = pageData && pageData.pageType === 'panels' && pageData.panels.length > 0;

    if (hasCurrentPanels) {
      // Check if current panel has earlier stops to retreat through
      const curIdx = currentPanelIndexRef.current;
      if (curIdx >= 0 && curIdx < pageData.panels.length && panelStopRef.current > 0) {
        panelStopRef.current--;
        setPanelStopTick(t => t + 1);
        zoomToPanel(pageData.panels[curIdx], panelStopRef.current);
        return true;
      }

      const prevIndex = curIdx - 1;

      if (prevIndex >= 0) {
        setCurrentPanelIndex(prevIndex);
        currentPanelIndexRef.current = prevIndex;
        const { stopCount } = computeStopCount(pageData.panels[prevIndex]);
        panelStopRef.current = stopCount - 1;
        zoomToPanel(pageData.panels[prevIndex], panelStopRef.current);
        return true;
      }
    }

    // At first panel (or current page has no panels) — try cross-page transition
    const prevPageNum = currentPage - 1;
    if (!pdfDocument || prevPageNum < 1) {
      // No previous page — exit zoom and fall through (start of volume)
      if (isZoomedRef.current) exitZoom(true);
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
      return false;
    }

    const prevPageData = panelDataMap.get(prevPageNum);
    const lastPanel = prevPageData?.pageType === 'panels' && prevPageData.panels.length > 0
      ? prevPageData.panels[prevPageData.panels.length - 1] : null;
    const lastPanelIndex = prevPageData ? prevPageData.panels.length - 1 : -1;

    if (!lastPanel) {
      // Previous page has no panels — exit zoom and fall through to animateStrip
      if (isZoomedRef.current) exitZoom(true);
      setCurrentPanelIndex(-1);
      currentPanelIndexRef.current = -1;
      panelStopRef.current = 0;
      return false;
    }

    // Pre-render previous page zoomed to last panel and slide in
    // targetStopIndex = -1 means "use last stop" (resolved inside slideToZoomedPage)
    return slideToZoomedPage(prevPageNum, lastPanel, lastPanelIndex, -1, 'back');
  }, [smartPanelZoom, hasPanelData, panelDataMap, currentPage, zoomToPanel, exitZoom, pdfDocument, computeStopCount, slideToZoomedPage]);

  // ── Unified navigation dispatch ─────────────────────────────────────────
  // All input handlers call this instead of directly calling goNextPage/goPrevPage/
  // advancePanel/retreatPanel/animateStrip. This ensures consistent behavior across
  // keyboard, arrow buttons, click/tap, touch swipe, and scroll wheel.

  const navigateReading = useCallback((direction: 'forward' | 'back') => {
    // Set direction ref so auto-zoom effect knows which panel to target
    autoZoomDirectionRef.current = direction;

    // Map reading direction to strip direction for animateStrip
    // 'forward' reading = strip 'forward' in LTR, strip 'back' in RTL
    const stripDir: 'forward' | 'back' = effectiveDirection === 'rtl'
      ? (direction === 'forward' ? 'back' : 'forward')
      : direction;

    if (smartPanelZoom && hasPanelData && !isVertical && !panelZoomPausedRef.current) {
      // Try panel-by-panel navigation first (skip when user paused panel zoom)
      if (direction === 'forward') {
        if (advancePanel()) return;
      } else {
        if (retreatPanel()) return;
      }
      // advancePanel/retreatPanel returned false — no more panels, or current page
      // has no panels. Fall through to page-level navigation.
      // Reset neighbor zoom wrappers so animateStrip doesn't show stale zoomed content.
      for (const w of [prevZoomWrapperRef.current, nextZoomWrapperRef.current]) {
        if (w) {
          w.style.transition = 'none';
          w.style.transform = 'none';
        }
      }
    }

    if (spreadMode) {
      // Spread mode doesn't use the carousel strip
      if (direction === 'forward') goNextPage();
      else goPrevPage();
      return;
    }

    if (isVertical) {
      // Vertical mode uses native scrolling — nothing to do here
      return;
    }

    // Single-page carousel: animate the strip slide
    animateStrip(stripDir);
  }, [effectiveDirection, smartPanelZoom, hasPanelData, isVertical, spreadMode,
      advancePanel, retreatPanel, goNextPage, goPrevPage, animateStrip]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (settingsModalOpen) return;

      if (isVertical) {
        // In vertical mode, let browser handle up/down scrolling natively
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateReading(effectiveDirection === 'rtl' ? 'forward' : 'back');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateReading(effectiveDirection === 'rtl' ? 'back' : 'forward');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [effectiveDirection, isVertical, navigateReading, settingsModalOpen]);

  // ── Touch handlers ──────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isVertical) return;
    if (spreadMode) return;

    // Fresh gesture: clear the pinch-occurred-during-this-gesture flag.
    if (e.touches.length === 1) {
      gestureHadPinchRef.current = false;
    }

    // If a cross-page commit's strip transition is still in flight, finalize
    // it synchronously so this new gesture sees the post-commit page/zoom
    // state. Without this, panelDragRef gets populated from stale refs and
    // the next move applies a within-page lerp against the wrong page.
    if (activeCommitListenerRef.current) {
      const strip = stripRef.current;
      const pendingListener = activeCommitListenerRef.current;
      if (strip) {
        strip.removeEventListener('transitionend', pendingListener);
      }
      activeCommitListenerRef.current = null;
      pendingListener();
    }

    // Pinch start: second finger joins. Route to pinch, skipping single-finger setup.
    if (e.touches.length === 2 && !pinchStateRef.current) {
      // During an unzoomed strip animation, defer pinch — safer than cancelling mid-slide.
      if (isAnimatingRef.current && !isZoomedRef.current) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Clear any single-finger in-flight state so pinch-move doesn't see stale deltas.
      touchStartRef.current = null;
      panelDragRef.current = null;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      // If a cross-page drag was mid-flight, the strip may still be partially
      // translated — snap it back so the pinch operates on the centered slot.
      const strip = stripRef.current;
      if (strip) {
        if (activeCommitListenerRef.current) {
          strip.removeEventListener('transitionend', activeCommitListenerRef.current);
          activeCommitListenerRef.current = null;
        }
        strip.style.transition = 'none';
        strip.style.transform = 'translateX(-100vw)';
      }

      const { mid: mid0, dist: dist0 } = getPinchGeometry(e.touches);
      const vW = window.innerWidth;
      const vH = container.clientHeight;
      const cw = parseFloat(canvas.style.width) || 0;
      const ch = parseFloat(canvas.style.height) || 0;
      const natLeft = (vW - cw) / 2;
      const natTop = (vH - ch) / 2;

      // If starting from unzoomed, seed the zoom origin at the midpoint (in canvas-local
      // coords) and activate zoom state at scale = 1. At scale 1 this is visually a no-op.
      if (!isZoomedRef.current) {
        zoomOriginRef.current = { x: mid0.x - natLeft, y: mid0.y - natTop };
        zoomScaleRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        isZoomedRef.current = true;
        setIsZoomed(true);
      }

      const scale0 = zoomScaleRef.current;
      const pan0 = panRef.current;
      const origin0 = zoomOriginRef.current;
      // Canvas-local point under the initial midpoint, derived from the current transform.
      const P0x = (mid0.x - natLeft - origin0.x * (1 - scale0) - pan0.x) / scale0;
      const P0y = (mid0.y - natTop - origin0.y * (1 - scale0) - pan0.y) / scale0;

      pinchStateRef.current = {
        dist0: Math.max(dist0, 1),
        mid0,
        scale0,
        P0: { x: P0x, y: P0y },
        natLeft,
        natTop,
      };
      gestureHadPinchRef.current = true;
      return;
    }

    // Single-touch setup (unchanged).
    // Allow recording touch while zoomed (needed for pan); block carousel animation only
    if (isAnimatingRef.current && !isZoomedRef.current) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    // Snapshot current pan for panel drag and regular zoom panning
    panStartRef.current = { x: panRef.current.x, y: panRef.current.y };

    // Cache panel drag state: current transform + forward/backward targets
    panelDragRef.current = null;
    if (smartPanelZoom && hasPanelData && isZoomedRef.current) {
      // Use the ref, not the state — handleTouchStart may run synchronously
      // after a just-flushed cross-page commit, before React has applied
      // setCurrentPage. The ref is updated synchronously inside commit.
      const pageData = panelDataMap.get(currentPageRef.current);
      const curIdx = currentPanelIndexRef.current;
      if (pageData && curIdx >= 0 && curIdx < pageData.panels.length) {
        const curPanel = pageData.panels[curIdx];
        const curStop = panelStopRef.current;
        // Use live refs (not computePanelTransform) so a swipe after a pinch
        // interpolates from the actual current position, not the pristine
        // panel transform.
        const start: PanelTransform = {
          ox: zoomOriginRef.current.x,
          oy: zoomOriginRef.current.y,
          scale: zoomScaleRef.current,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };

        const { stopCount } = computeStopCount(curPanel);

        // Forward target: next stop (same panel) or next panel (stop 0)
        let forwardTarget: PanelTransform | null = null;
        let forwardTargetPanel: Panel | null = null;
        if (curStop < stopCount - 1) {
          forwardTarget = computePanelTransform(curPanel, curStop + 1);
          forwardTargetPanel = curPanel;
        } else if (curIdx + 1 < pageData.panels.length) {
          forwardTargetPanel = pageData.panels[curIdx + 1];
          forwardTarget = computePanelTransform(forwardTargetPanel, 0);
        }

        // Backward target: prev stop (same panel) or prev panel (last stop)
        let backwardTarget: PanelTransform | null = null;
        let backwardTargetPanel: Panel | null = null;
        if (curStop > 0) {
          backwardTarget = computePanelTransform(curPanel, curStop - 1);
          backwardTargetPanel = curPanel;
        } else if (curIdx - 1 >= 0) {
          backwardTargetPanel = pageData.panels[curIdx - 1];
          const { stopCount: prevStops } = computeStopCount(backwardTargetPanel);
          backwardTarget = computePanelTransform(backwardTargetPanel, prevStops - 1);
        }

        // Cross-page targets: only when within-page is null in that direction
        // and we're at the matching boundary panel.
        const isAtLastPanel = curIdx === pageData.panels.length - 1
          && curStop === stopCount - 1;
        const isAtFirstPanel = curIdx === 0 && curStop === 0;
        const crossPageForward = (forwardTarget === null && isAtLastPanel)
          ? crossPageReadyRef.current.forward
          : null;
        const crossPageBackward = (backwardTarget === null && isAtFirstPanel)
          ? crossPageReadyRef.current.backward
          : null;

        panelDragRef.current = {
          start,
          startPanel: curPanel,
          forwardTarget,
          forwardTargetPanel,
          backwardTarget,
          backwardTargetPanel,
          crossPageForward,
          crossPageBackward,
          crossPageActive: null,
          isDragging: false,
        };
      }
    }
  }, [isVertical, spreadMode, smartPanelZoom, hasPanelData, panelDataMap, currentPage, computePanelTransform, computeStopCount, getPinchGeometry]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isVertical || spreadMode) return;

    // Pinch-move: two fingers and we're tracking a pinch.
    if (pinchStateRef.current && e.touches.length >= 2) {
      const pinch = pinchStateRef.current;
      const { mid, dist } = getPinchGeometry(e.touches);
      const rawScale = pinch.scale0 * (dist / pinch.dist0);
      const scale = Math.max(1, Math.min(5, rawScale));
      const origin = zoomOriginRef.current;
      // pan formula derived from "page point P0 under initial midpoint should land under current midpoint"
      const panX = mid.x - pinch.natLeft - origin.x * (1 - scale) - pinch.P0.x * scale;
      const panY = mid.y - pinch.natTop - origin.y * (1 - scale) - pinch.P0.y * scale;
      zoomScaleRef.current = scale;
      panRef.current = { x: panX, y: panY };
      applyZoomTransform(false);
      return;
    }

    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (isZoomedRef.current) {
      if (smartPanelZoom && hasPanelData && panelDragRef.current) {
        // Panel swipe: interpolate between current and target panel/stop transform
        const drag = panelDragRef.current;
        const deadZone = 20;
        if (Math.abs(dx) < deadZone) return;
        drag.isDragging = true;
        const adjustedDx = dx - Math.sign(dx) * deadZone;
        const isForward = effectiveDirection === 'rtl' ? adjustedDx > 0 : adjustedDx < 0;
        const target = isForward ? drag.forwardTarget : drag.backwardTarget;
        const targetPanel = isForward ? drag.forwardTargetPanel : drag.backwardTargetPanel;
        const threshold = window.innerWidth * 0.4;
        const progress = Math.min(Math.abs(adjustedDx) / threshold, 1);

        if (!target) {
          // Cross-page live preview: if the neighbor is pre-rendered, translate
          // the strip with the finger and morph the letterbox between the two
          // panel rects. Otherwise fall back to the existing rubber-band path.
          const crossTarget = isForward ? drag.crossPageForward : drag.crossPageBackward;
          if (crossTarget) {
            drag.crossPageActive = isForward ? 'forward' : 'backward';
            const vW = window.innerWidth;
            const crossProgress = Math.min(Math.abs(adjustedDx) / vW, 1);
            // Move strip in CSS vw units so slots (sized via w-screen / 100vw)
            // tile exactly. Mixing JS px with vw causes a sub-pixel drift that
            // compounds visibly into overlapping slots on devices where
            // window.innerWidth ≠ 100vw (mobile address bar, scrollbars).
            const slotTargetOffsetPx = crossTarget.slot === 'prev' ? vW : -vW;
            const stripOffsetPx = slotTargetOffsetPx * crossProgress;
            const stripTranslateX = -vW + stripOffsetPx;
            const strip = stripRef.current;
            if (strip) {
              if (activeCommitListenerRef.current) {
                strip.removeEventListener('transitionend', activeCommitListenerRef.current);
                activeCommitListenerRef.current = null;
              }
              strip.style.transition = 'none';
              strip.style.transform = `translateX(calc(-100vw + ${stripOffsetPx}px))`;
            }
            writeLetterbox({
              dragInterp: {
                kind: 'cross-page',
                fromPanel: drag.startPanel,
                fromTransform: liveTransform(),
                toPanel: crossTarget.panel,
                toTransform: crossTarget.transform,
                slot: crossTarget.slot,
                stripTranslateX,
                progress: crossProgress,
              },
            });
            return;
          }
          // Cross-page fallback: rubber-band with resistance
          const resistance = 0.15;
          const t = { ...drag.start, panX: drag.start.panX + adjustedDx * resistance };
          applyInterpolatedTransform(t);
          return;
        }

        // Lerp all transform params toward the target
        const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
        const s = drag.start;
        applyInterpolatedTransform(
          {
            ox: lerp(s.ox, target.ox, progress),
            oy: lerp(s.oy, target.oy, progress),
            scale: lerp(s.scale, target.scale, progress),
            panX: lerp(s.panX, target.panX, progress),
            panY: lerp(s.panY, target.panY, progress),
          },
          targetPanel
            ? { fromTransform: s, toPanel: targetPanel, toTransform: target, progress }
            : undefined,
        );
        return;
      }
      if (smartPanelZoom && hasPanelData) {
        return;
      }
      // Pan the zoomed canvas; clamp to page bounds
      const bounds = computePanBounds();
      panRef.current = {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, panRef.current.x + dx)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, panRef.current.y + dy)),
      };
      // Reset origin each move so delta is incremental
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: touchStartRef.current.time };
      applyZoomTransform(false);
      return;
    }

    if (smartPanelZoom && hasPanelData && !panelZoomPausedRef.current) {
      // In panel mode (not zoomed, not paused): don't drag strip, let handleTouchEnd handle swipe direction
      return;
    }

    dragOffsetRef.current = dx;
    setStripTransform(dx, false);
  }, [isVertical, spreadMode, setStripTransform, computePanBounds, applyZoomTransform, applyInterpolatedTransform, smartPanelZoom, hasPanelData, effectiveDirection, getPinchGeometry, writeLetterbox, liveTransform]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Pinch end: one (or zero) fingers remain on a tracked pinch.
      if (pinchStateRef.current && e.touches.length < 2) {
        pinchStateRef.current = null;

        // If one finger remains, hand off to single-finger pan — seed touchStartRef
        // with its coords so subsequent moves are incremental, not a jump.
        if (e.touches.length === 1) {
          const remaining = e.touches[0];
          touchStartRef.current = { x: remaining.clientX, y: remaining.clientY, time: Date.now() };
          panStartRef.current = { x: panRef.current.x, y: panRef.current.y };
        } else {
          touchStartRef.current = null;
        }

        suppressNextClickRef.current = true;

        // Below the fit threshold → snap back to full page.
        // Pinching all the way out is an "escape" gesture: also pause panel
        // auto-zoom so the next swipe turns pages, same as double-tap-out.
        const finalScale = zoomScaleRef.current;
        if (finalScale < 1.05) {
          if (smartPanelZoom) {
            panelZoomPausedRef.current = true;
            setCurrentPanelIndex(-1);
            currentPanelIndexRef.current = -1;
            panelStopRef.current = 0;
          }
          exitZoom(true);
          return;
        }

        // Settle: clamp pan to bounds, animate transform, then kick hi-res re-render.
        const bounds = computePanBounds();
        panRef.current = {
          x: Math.min(bounds.maxX, Math.max(bounds.minX, panRef.current.x)),
          y: Math.min(bounds.maxY, Math.max(bounds.minY, panRef.current.y)),
        };
        applyZoomTransform(true);
        scheduleHiResRerender(finalScale);
        return;
      }

      // Gesture ended without pinch-end cleanup but was a pinch at some point
      // (e.g. all fingers lifted simultaneously on a different code path).
      // Skip tap/swipe interpretation — this wasn't a single-finger gesture.
      if (gestureHadPinchRef.current) {
        touchStartRef.current = null;
        panelDragRef.current = null;
        suppressNextClickRef.current = true;
        return;
      }

      if (isVertical || spreadMode) {
        // Spread mode: legacy swipe behavior
        if (!spreadMode) return;
        if (!touchStartRef.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        e.preventDefault();
        // dx < 0 = swipe left = forward in LTR
        const isForward = effectiveDirection === 'rtl' ? dx > 0 : dx < 0;
        navigateReading(isForward ? 'forward' : 'back');
        return;
      }

      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      const isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300;

      if (isTap) {
        suppressNextClickRef.current = true;

        if (detectDoubleTap(touch.clientX, touch.clientY)) {
          // Cancel any in-flight single-tap action
          if (tapTimerRef.current) {
            clearTimeout(tapTimerRef.current);
            tapTimerRef.current = null;
          }
          if (smartPanelZoom && hasPanelData) {
            if (isZoomedRef.current) {
              // Double-tap while zoomed in panel mode: exit to full page (pause panel zoom)
              panelZoomPausedRef.current = true;
              exitZoom(true);
              setCurrentPanelIndex(-1);
              currentPanelIndexRef.current = -1;
              panelStopRef.current = 0;
            } else {
              // Double-tap on full page: hit-test panels, zoom if matched
              const hit = hitTestPanel(touch.clientX, touch.clientY);
              const pageData = panelDataMap.get(currentPage);
              if (hit) {
                panelZoomPausedRef.current = false;
                setCurrentPanelIndex(hit.index);
                currentPanelIndexRef.current = hit.index;
                panelStopRef.current = 0;
                zoomToPanel(hit.panel, 0);
              } else if (pageData && pageData.pageType === 'panels' && pageData.panels.length > 0) {
                // Double-tap on empty space: zoom to first panel
                panelZoomPausedRef.current = false;
                setCurrentPanelIndex(0);
                currentPanelIndexRef.current = 0;
                panelStopRef.current = 0;
                zoomToPanel(pageData.panels[0], 0);
              }
            }
          } else if (isZoomedRef.current) {
            exitZoom(true);
          } else {
            enterZoom(touch.clientX, touch.clientY);
          }
          return;
        }

        // Single tap — defer by 280ms to allow double-tap detection
        const tapX = touch.clientX;
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          if (smartPanelZoom && hasPanelData) {
            // Smart panel zoom: single tap always toggles toolbar
            setBarsVisible((v) => !v);
          } else if (isZoomedRef.current) {
            // While zoomed (non-panel): only toggle toolbar
            setBarsVisible((v) => !v);
          } else if (settings.tapToTurn) {
            const ratio = tapX / window.innerWidth;
            if (ratio < 0.25) {
              navigateReading(effectiveDirection === 'rtl' ? 'forward' : 'back');
            } else if (ratio > 0.75) {
              navigateReading(effectiveDirection === 'rtl' ? 'back' : 'forward');
            } else {
              setBarsVisible((v) => !v);
            }
          } else {
            setBarsVisible((v) => !v);
          }
        }, 280);
        return;
      }

      // Non-tap gesture (swipe/pan)

      // Panel drag: commit navigation or snap back based on drag progress
      if (smartPanelZoom && hasPanelData && isZoomedRef.current) {
        const drag = panelDragRef.current;
        panelDragRef.current = null;

        // Helper to restore zoom refs to the start transform before navigating/snapping
        const restoreStart = () => {
          if (!drag) return;
          zoomOriginRef.current = { x: drag.start.ox, y: drag.start.oy };
          zoomScaleRef.current = drag.start.scale;
          panRef.current = { x: drag.start.panX, y: drag.start.panY };
        };

        const deadZone = 20;
        const commitThreshold = window.innerWidth * 0.2;
        const isVerticalSwipe = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= 30;

        if (isVerticalSwipe) {
          if (drag?.isDragging) restoreStart();
          // Snap strip back if a cross-page drag was in progress.
          if (drag?.crossPageActive) {
            const strip = stripRef.current;
            if (strip) {
              if (activeCommitListenerRef.current) {
                strip.removeEventListener('transitionend', activeCommitListenerRef.current);
                activeCommitListenerRef.current = null;
              }
              strip.style.transition = 'none';
              strip.style.transform = 'translateX(-100vw)';
            }
          }
          navigateReading(dy < 0 ? 'forward' : 'back');
          return;
        }

        const velocity = Math.abs(dx) / dt; // px/ms
        const isFastFlick = velocity > 0.3;
        const adjustedDx = Math.abs(dx) > deadZone ? dx - Math.sign(dx) * deadZone : 0;
        const isForward = effectiveDirection === 'rtl' ? adjustedDx > 0 : adjustedDx < 0;
        const shouldCommit = isFastFlick || Math.abs(adjustedDx) >= commitThreshold;

        // Cross-page live drag commit/cancel
        if (drag?.crossPageActive) {
          const isCrossForward = drag.crossPageActive === 'forward';
          const crossTarget = isCrossForward ? drag.crossPageForward : drag.crossPageBackward;
          const strip = stripRef.current;
          if (crossTarget && strip) {
            const vW = window.innerWidth;
            const crossProgress = Math.min(Math.abs(adjustedDx) / vW, 1);
            const slotTargetX = crossTarget.slot === 'prev' ? 0 : -2 * vW;
            const directionMatchesActive = isCrossForward === isForward;

            if (shouldCommit && directionMatchesActive && Math.abs(dx) >= deadZone) {
              const remaining = Math.max(0.05, 1 - crossProgress);
              const duration = Math.round(250 * remaining);
              const slotTargetOffset = crossTarget.slot === 'prev' ? '100vw' : '-100vw';
              strip.style.transition = `transform ${duration}ms ease-out`;
              strip.style.transform = `translateX(calc(-100vw + ${slotTargetOffset}))`;
              // Morph the bars from their current mid-drag rect to the
              // to-rect over the same duration and curve as the strip's
              // commit transition. The bars are already at the mid-drag
              // rect (last touchmove wrote that with transition='none'),
              // so a single write with crossPageTransitionMs triggers a
              // CSS transition from the visible state to the to-rect.
              writeLetterbox({
                dragInterp: {
                  kind: 'cross-page',
                  fromPanel: drag.startPanel,
                  fromTransform: liveTransform(),
                  toPanel: crossTarget.panel,
                  toTransform: crossTarget.transform,
                  slot: crossTarget.slot,
                  stripTranslateX: slotTargetX,
                  progress: 1,
                  crossPageTransitionMs: duration,
                },
              });
              // Cancel any prior leaked listener before registering a new one.
              if (activeCommitListenerRef.current) {
                strip.removeEventListener('transitionend', activeCommitListenerRef.current);
                activeCommitListenerRef.current = null;
              }
              const onEnd = () => {
                strip.removeEventListener('transitionend', onEnd);
                if (activeCommitListenerRef.current === onEnd) {
                  activeCommitListenerRef.current = null;
                }
                commitNeighborSlide({
                  targetPageNum: crossTarget.pageNum,
                  targetPanelIndex: crossTarget.panelIndex,
                  resolvedStopIndex: crossTarget.stopIndex,
                  transform: crossTarget.transform,
                  slot: crossTarget.slot,
                  readingDir: crossTarget.readingDir,
                });
              };
              activeCommitListenerRef.current = onEnd;
              strip.addEventListener('transitionend', onEnd);
              return;
            }

            // Cancel: spring strip back to centered, letterbox transitions
            // back to from-rect over the same duration as the strip's
            // spring-back. A single CSS-driven write replaces the prior
            // per-frame stepBack rAF loop — the bars are already at the
            // mid-drag rect (transition='none') so changing transition to
            // ${duration}ms and rect to from-rect fires a clean transition.
            const duration = Math.max(80, Math.round(250 * crossProgress));
            if (activeCommitListenerRef.current) {
              strip.removeEventListener('transitionend', activeCommitListenerRef.current);
              activeCommitListenerRef.current = null;
            }
            strip.style.transition = `transform ${duration}ms ease-out`;
            strip.style.transform = `translateX(calc(-100vw + 0px))`;
            writeLetterbox({
              dragInterp: {
                kind: 'cross-page',
                fromPanel: drag.startPanel,
                fromTransform: liveTransform(),
                toPanel: crossTarget.panel,
                toTransform: crossTarget.transform,
                slot: crossTarget.slot,
                stripTranslateX: -vW,
                progress: 0,
                crossPageTransitionMs: duration,
              },
            });
            return;
          }
        }

        if (shouldCommit && Math.abs(dx) >= deadZone) {
          if (drag?.isDragging) restoreStart();
          navigateReading(isForward ? 'forward' : 'back');
          return;
        }

        // Snap back: restore refs and animate to start transform
        if (drag?.isDragging) {
          restoreStart();
          applyZoomTransform(true);
        }
        return;
      }

      const isHorizontalSwipe = Math.abs(dx) >= Math.abs(dy) * 0.5 || Math.abs(dx) >= 30;
      if (!isHorizontalSwipe) {
        if (!isZoomedRef.current) springBack();
        return;
      }

      const velocity = Math.abs(dx) / dt; // px/ms
      const isFastFlick = velocity > 0.3;
      const threshold = window.innerWidth * 0.3;
      const isSwipe = isFastFlick || Math.abs(dx) >= threshold;
      if (!isSwipe) {
        if (!isZoomedRef.current) springBack();
        return;
      }

      // Determine swipe direction relative to reading direction
      const isForwardSwipe = effectiveDirection === 'rtl' ? dx > 0 : dx < 0;

      if (smartPanelZoom && hasPanelData) {
        // Single-stop panel or unzoomed: navigateReading handles it
        navigateReading(isForwardSwipe ? 'forward' : 'back');
        return;
      }

      // Not in panel mode: if zoomed, pan was already applied in handleTouchMove
      if (isZoomedRef.current) return;

      // Normal carousel swipe
      navigateReading(isForwardSwipe ? 'forward' : 'back');
    },
    [isVertical, spreadMode, effectiveDirection, settings.tapToTurn,
     navigateReading, springBack, applyZoomTransform,
     detectDoubleTap, enterZoom, exitZoom, smartPanelZoom, hasPanelData,
     hitTestPanel, zoomToPanel, panelDataMap, currentPage,
     computePanBounds, scheduleHiResRerender, commitNeighborSlide, writeLetterbox, liveTransform]
  );

  // Legacy swipe for spread mode (tap-based, no drag)
  const handleSpreadTouchStart = useCallback((e: React.TouchEvent) => {
    if (!spreadMode) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, [spreadMode]);

  // Tap handler with tap-to-turn zone detection (mouse/desktop only; mobile taps handled in touchend)
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (settingsModalOpen) return;
      // Suppress click if a touch gesture already handled this tap
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      // Smart panel zoom: click toggles bars (navigation handled by swipe/keyboard/wheel)
      if (smartPanelZoom && hasPanelData && !isVertical) {
        setBarsVisible((v) => !v);
        return;
      }

      if (settings.tapToTurn && !isVertical) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const ratio = x / width;

        // Left 25%, center 50%, right 25%
        if (ratio < 0.25) {
          navigateReading(effectiveDirection === 'rtl' ? 'forward' : 'back');
          return;
        } else if (ratio > 0.75) {
          navigateReading(effectiveDirection === 'rtl' ? 'back' : 'forward');
          return;
        }
        // Center zone — fall through to toggle bars
      }

      setBarsVisible((v) => !v);
    },
    [settings.tapToTurn, isVertical, effectiveDirection, settingsModalOpen, smartPanelZoom, hasPanelData, navigateReading]
  );

  // Scroll wheel handler. Attached via addEventListener with passive: false
  // (in the effect below) so preventDefault actually suppresses page scroll —
  // React's onWheel prop is passive by default and would log a warning.
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (isVertical) return;
      e.preventDefault();
      if (isAnimatingRef.current) return;

      const now = Date.now();
      if (now - lastWheelNavRef.current < 300) return;
      lastWheelNavRef.current = now;

      navigateReading(e.deltaY > 0 ? 'forward' : 'back');
    },
    [isVertical, navigateReading]
  );

  useEffect(() => {
    if (isVertical) return;
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isVertical, handleWheel]);

  // Settings change handler with debounced save
  const handleSettingsChange = useCallback(
    (newSettings: ReaderSettings) => {
      setSettings(newSettings);

      if (!profileId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(apiUrl(`/api/profiles/${profileId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reader_settings: newSettings }),
        }).catch((err) => console.error('Failed to save settings:', err));
      }, 500);
    },
    [profileId]
  );

  // Show arrow buttons on mouse move (desktop, paginated mode only)
  const handleMouseMove = useCallback(() => {
    if (isVertical) return;
    setArrowsVisible(true);
    if (arrowHideTimerRef.current) clearTimeout(arrowHideTimerRef.current);
    arrowHideTimerRef.current = setTimeout(() => setArrowsVisible(false), 2000);
  }, [isVertical]);

  // Clean up arrow hide timer
  useEffect(() => {
    return () => {
      if (arrowHideTimerRef.current) clearTimeout(arrowHideTimerRef.current);
    };
  }, []);

  // Arrow button click handlers (stop propagation to avoid tap-to-turn)
  const handleArrowClick = useCallback(
    (direction: 'left' | 'right', e: React.MouseEvent) => {
      e.stopPropagation();
      if (direction === 'left') {
        navigateReading(effectiveDirection === 'rtl' ? 'forward' : 'back');
      } else {
        navigateReading(effectiveDirection === 'rtl' ? 'back' : 'forward');
      }
    },
    [effectiveDirection, navigateReading]
  );

  // Handle page change from any source (vertical scroll, scrub bar, dropdown)
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-lg">Loading manga...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen bg-black overflow-hidden select-none ${isVertical ? '' : 'touch-none'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={!isVertical && !spreadMode ? handleTouchMove : undefined}
      onTouchEnd={handleTouchEnd}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      tabIndex={0}
    >
      {/* Reading area */}
      {isVertical && pdfDocument ? (
        <VerticalScrollView
          pdfDocument={pdfDocument}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          snapEnabled={settings.verticalSnap}
        />
      ) : spreadMode ? (
        // Spread mode: two canvases side by side, unchanged
        <div className="flex items-center justify-center w-full h-full">
          <div className="flex items-center justify-center h-full gap-0">
            <canvas ref={canvasRef} className="max-h-full" />
            <canvas ref={canvasRef2} className="max-h-full" />
          </div>
        </div>
      ) : (
        // Single-page carousel strip
        <div className="w-full h-full overflow-hidden">
          <div
            ref={stripRef}
            className="flex h-full"
            style={{
              width: '300vw',
              transform: 'translateX(-100vw)',
              willChange: 'transform',
            }}
          >
            {/* Prev slot */}
            <div className="w-screen h-full flex items-center justify-center overflow-hidden">
              <div ref={prevZoomWrapperRef} style={{ transformOrigin: '0 0' }}>
                <canvas ref={prevCanvasRef} className="max-h-full max-w-full" />
              </div>
            </div>
            {/* Current slot */}
            <div className="w-screen h-full flex items-center justify-center overflow-hidden">
              <div ref={zoomWrapperRef} style={{ transformOrigin: '0 0' }}>
                <canvas ref={canvasRef} className="max-h-full max-w-full" />
              </div>
            </div>
            {/* Next slot */}
            <div className="w-screen h-full flex items-center justify-center overflow-hidden">
              <div ref={nextZoomWrapperRef} style={{ transformOrigin: '0 0' }}>
                <canvas ref={nextCanvasRef} className="max-h-full max-w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus Mode letterbox — four black bars framing the current panel.
          Bars are positioned/sized via direct DOM writes inside writeLetterbox. */}
      {!isVertical && !spreadMode && (
        <div
          ref={letterboxGroupRef}
          className="absolute inset-0 pointer-events-none z-[15]"
          style={{ opacity: 0, transition: 'opacity 150ms ease-out' }}
        >
          <div ref={letterboxTopRef} className="absolute bg-black" />
          <div ref={letterboxBottomRef} className="absolute bg-black" />
          <div ref={letterboxLeftRef} className="absolute bg-black" />
          <div ref={letterboxRightRef} className="absolute bg-black" />
        </div>
      )}

      {/* Page rendering spinner */}
      {pageRendering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Floating back button — always visible but subtle */}
      {!barsVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/library/${seriesId}`);
          }}
          className="absolute top-4 left-4 z-30 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/90 backdrop-blur-sm transition-all duration-200 cursor-pointer"
          aria-label="Back to series"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Top bar */}
      <ReaderToolbar
        visible={barsVisible}
        seriesId={seriesId}
        title={title}
        onSettingsOpen={() => {
          setSettingsModalOpen(true);
        }}
      />

      {/* Bottom bar */}
      <ReaderBottomBar
        visible={barsVisible}
        currentPage={currentPage}
        totalPages={totalPages}
        spreadMode={spreadMode}
        pdfDocument={pdfDocument}
        onPageChange={handlePageChange}
        isVertical={isVertical}
        direction={effectiveDirection === 'rtl' ? 'rtl' : 'ltr'}
      />

      {/* Desktop arrow navigation buttons */}
      {!isVertical && isWideViewport && (
        <>
          <button
            onClick={(e) => handleArrowClick('left', e)}
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-20 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white/70 hover:text-white backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
              arrowsVisible && (effectiveDirection === 'rtl' ? currentPage < totalPages : currentPage > 1) ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label={effectiveDirection === 'rtl' ? 'Next page' : 'Previous page'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={(e) => handleArrowClick('right', e)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-20 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white/70 hover:text-white backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
              arrowsVisible && (effectiveDirection === 'rtl' ? currentPage > 1 : currentPage < totalPages) ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label={effectiveDirection === 'rtl' ? 'Previous page' : 'Next page'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </>
      )}

      {/* End/start of volume overlay */}
      {volumeOverlay && (
        <EndOfVolumeOverlay
          seriesId={seriesId}
          direction={volumeOverlay}
          nextVolumeId={nextVolumeId}
          nextVolumeTitle={nextVolumeTitle}
          prevVolumeId={prevVolumeId}
          prevVolumeTitle={prevVolumeTitle}
          onDismiss={() => setVolumeOverlay(null)}
        />
      )}

      {/* Settings modal */}
      <ReaderSettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        isWideViewport={isWideViewport}
        smartPanelZoom={smartPanelZoom}
        onSmartPanelZoomChange={handleSmartPanelZoomChange}
        hasPanelData={hasPanelData}
        focusMode={focusMode}
        onFocusModeChange={handleFocusModeChange}
      />
    </div>
  );
}
