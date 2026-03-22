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

  // Detect wide viewport
  useEffect(() => {
    const checkWidth = () => setIsWideViewport(window.innerWidth > 1024);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/manga/${seriesId}/${volumeId}/pdf`;
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
      const containerWidth = container.clientWidth * widthFraction;
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

      if (leftPage >= 1 && leftPage <= pdfDocument.numPages) {
        renderPage(pdfDocument, leftPage, canvas1, renderTaskRef, 0.5);
      } else {
        canvas1.width = 0;
        canvas1.height = 0;
      }
      if (rightPage >= 1 && rightPage <= pdfDocument.numPages) {
        renderPage(pdfDocument, rightPage, canvas2, renderTaskRef2, 0.5);
      } else {
        canvas2.width = 0;
        canvas2.height = 0;
      }
    } else {
      // Single-page carousel: render current first, then neighbors
      const canvas = canvasRef.current;
      renderPage(pdfDocument, currentPage, canvas, renderTaskRef);

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
        // Re-render all three strip canvases
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
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, volumeId: Number(volumeId), currentPage }),
      })
        .then(() => {
          const key = `progress:${profileId}:${volumeId}`;
          localStorage.removeItem(key);
        })
        .catch((err) => console.error('Failed to save progress:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [profileId, volumeId, currentPage]);

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
        if (effectiveDirection === 'rtl') goNextPage();
        else goPrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (effectiveDirection === 'rtl') goPrevPage();
        else goNextPage();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [effectiveDirection, isVertical, goNextPage, goPrevPage, settingsModalOpen]);

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
      // Trigger end/start overlay if relevant, then spring back
      if (direction === 'forward' && currentPageVal >= totalPages) setVolumeOverlay('end');
      if (direction === 'back' && currentPageVal <= 1 && prevVolumeId) setVolumeOverlay('start');
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
        // Copy the incoming canvas into the current slot before resetting strip,
        // so there's no flash of the old page when translateX snaps back.
        const sourceCanvas = direction === 'forward' ? nextCanvasRef.current : prevCanvasRef.current;
        const destCanvas = canvasRef.current;
        if (sourceCanvas && destCanvas && sourceCanvas.width > 0) {
          destCanvas.width = sourceCanvas.width;
          destCanvas.height = sourceCanvas.height;
          destCanvas.style.width = sourceCanvas.style.width;
          destCanvas.style.height = sourceCanvas.style.height;
          const ctx = destCanvas.getContext('2d');
          if (ctx) ctx.drawImage(sourceCanvas, 0, 0);
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
  }, []);

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

  // Reset zoom when navigating to a different page
  useEffect(() => {
    if (isZoomedRef.current) exitZoom(false);
  }, [currentPage, exitZoom]);

  // ── Touch handlers ──────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isVertical) return;
    if (spreadMode) return;
    // Allow recording touch while zoomed (needed for pan); block carousel animation only
    if (isAnimatingRef.current && !isZoomedRef.current) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, [isVertical, spreadMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isVertical || spreadMode || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (isZoomedRef.current) {
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

    dragOffsetRef.current = dx;
    setStripTransform(dx, false);
  }, [isVertical, spreadMode, setStripTransform, computePanBounds, applyZoomTransform]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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
        if (dx < 0) {
          if (effectiveDirection === 'rtl') goPrevPage(); else goNextPage();
        } else {
          if (effectiveDirection === 'rtl') goNextPage(); else goPrevPage();
        }
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
          if (isZoomedRef.current) {
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
          if (isZoomedRef.current) {
            // While zoomed: only toggle toolbar
            setBarsVisible((v) => !v);
          } else if (settings.tapToTurn) {
            const ratio = tapX / window.innerWidth;
            if (ratio < 0.25) {
              if (effectiveDirection === 'rtl') goNextPage(); else goPrevPage();
            } else if (ratio > 0.75) {
              if (effectiveDirection === 'rtl') goPrevPage(); else goNextPage();
            } else {
              setBarsVisible((v) => !v);
            }
          } else {
            setBarsVisible((v) => !v);
          }
        }, 280);
        return;
      }

      // Non-tap gesture: if zoomed, pan was already applied in handleTouchMove
      if (isZoomedRef.current) return;

      // Carousel swipe logic
      if (Math.abs(dx) < Math.abs(dy) * 0.5 && Math.abs(dx) < 30) {
        springBack();
        return;
      }

      const velocity = Math.abs(dx) / dt; // px/ms
      const isFastFlick = velocity > 0.3;
      const threshold = window.innerWidth * 0.3;

      if (isFastFlick || Math.abs(dx) >= threshold) {
        animateStrip(dx < 0 ? 'forward' : 'back');
      } else {
        springBack();
      }
    },
    [isVertical, spreadMode, effectiveDirection, settings.tapToTurn,
     goNextPage, goPrevPage, animateStrip, springBack,
     detectDoubleTap, enterZoom, exitZoom]
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

      if (settings.tapToTurn && !isVertical) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const ratio = x / width;

        // Left 25%, center 50%, right 25%
        if (ratio < 0.25) {
          if (effectiveDirection === 'rtl') goNextPage();
          else goPrevPage();
          return;
        } else if (ratio > 0.75) {
          if (effectiveDirection === 'rtl') goPrevPage();
          else goNextPage();
          return;
        }
        // Center zone — fall through to toggle bars
      }

      setBarsVisible((v) => !v);
    },
    [settings.tapToTurn, isVertical, effectiveDirection, goNextPage, goPrevPage, settingsModalOpen]
  );

  // Scroll wheel handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isVertical || spreadMode) return;
      e.preventDefault();
      if (isAnimatingRef.current) return;
      animateStrip(e.deltaY > 0 ? 'forward' : 'back');
    },
    [isVertical, spreadMode, animateStrip]
  );

  // Settings change handler with debounced save
  const handleSettingsChange = useCallback(
    (newSettings: ReaderSettings) => {
      setSettings(newSettings);

      if (!profileId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/profiles/${profileId}`, {
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
        if (effectiveDirection === 'rtl') goNextPage();
        else goPrevPage();
      } else {
        if (effectiveDirection === 'rtl') goPrevPage();
        else goNextPage();
      }
    },
    [effectiveDirection, goNextPage, goPrevPage]
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
      className="relative w-screen h-screen bg-black overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={!isVertical && !spreadMode ? handleTouchMove : undefined}
      onTouchEnd={handleTouchEnd}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onWheel={!isVertical && !spreadMode ? handleWheel : undefined}
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
            <div className="w-screen h-full flex items-center justify-center">
              <canvas ref={prevCanvasRef} className="max-h-full max-w-full" />
            </div>
            {/* Current slot */}
            <div className="w-screen h-full flex items-center justify-center">
              <div ref={zoomWrapperRef} style={{ transformOrigin: '0 0' }}>
                <canvas ref={canvasRef} className="max-h-full max-w-full" />
              </div>
            </div>
            {/* Next slot */}
            <div className="w-screen h-full flex items-center justify-center">
              <canvas ref={nextCanvasRef} className="max-h-full max-w-full" />
            </div>
          </div>
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
      />
    </div>
  );
}
