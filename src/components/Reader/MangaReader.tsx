'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useProfile } from '@/components/ProfileProvider';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type ReadingDirection = 'rtl' | 'ltr';

interface MangaReaderProps {
  seriesId: string;
  volumeId: string;
  initialPage?: number;
  readingDirection?: ReadingDirection;
  profileId?: number;
}

export default function MangaReader({
  seriesId,
  volumeId,
  initialPage = 1,
  readingDirection = 'rtl',
  profileId,
}: MangaReaderProps) {
  const { profile } = useProfile();
  const effectiveDirection = profile?.reading_direction ?? readingDirection;

  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadMode, setSpreadMode] = useState(false);
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const renderTaskRef2 = useRef<{ cancel: () => void } | null>(null);

  // Detect wide viewport for spread mode
  useEffect(() => {
    const checkWidth = () => setIsWideViewport(window.innerWidth > 1024);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Disable spread mode when viewport shrinks
  useEffect(() => {
    if (!isWideViewport) setSpreadMode(false);
  }, [isWideViewport]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/manga/${seriesId}/${volumeId}/pdf`;
    getDocument(url).promise.then(
      (doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDocument(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      },
      (err) => {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
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
      if (pageNum < 1 || pageNum > doc.numPages) return;

      // Cancel any in-progress render
      if (taskRef.current) {
        taskRef.current.cancel();
        taskRef.current = null;
      }

      const page: PDFPageProxy = await doc.getPage(pageNum);
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth * widthFraction;
      const containerHeight = container.clientHeight;

      const viewport = page.getViewport({ scale: 1 });
      const scaleW = containerWidth / viewport.width;
      const scaleH = containerHeight / viewport.height;
      // Fit: use the smaller scale so the entire page is visible
      const scale = Math.min(scaleW, scaleH);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const renderTask = page.render({
        canvas,
        viewport: scaledViewport,
      });
      taskRef.current = { cancel: () => renderTask.cancel() };

      try {
        await renderTask.promise;
      } catch {
        // render cancelled, ignore
      }
    },
    []
  );

  // Render current page(s) whenever relevant state changes
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    if (spreadMode && canvasRef2.current) {
      const leftPage =
        effectiveDirection === 'rtl' ? currentPage + 1 : currentPage;
      const rightPage =
        effectiveDirection === 'rtl' ? currentPage : currentPage + 1;

      const canvas1 = canvasRef.current;
      const canvas2 = canvasRef2.current;

      // In spread mode each canvas gets half width
      if (leftPage >= 1 && leftPage <= pdfDocument.numPages) {
        renderPage(pdfDocument, leftPage, canvas1, renderTaskRef, 0.5);
      } else {
        const ctx = canvas1.getContext('2d');
        canvas1.width = 0;
        canvas1.height = 0;
        ctx?.clearRect(0, 0, 0, 0);
      }
      if (rightPage >= 1 && rightPage <= pdfDocument.numPages) {
        renderPage(pdfDocument, rightPage, canvas2, renderTaskRef2, 0.5);
      } else {
        const ctx = canvas2.getContext('2d');
        canvas2.width = 0;
        canvas2.height = 0;
        ctx?.clearRect(0, 0, 0, 0);
      }
    } else {
      renderPage(pdfDocument, currentPage, canvasRef.current, renderTaskRef);
    }
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, renderPage]);

  // Re-render on resize
  useEffect(() => {
    const onResize = () => {
      if (!pdfDocument || !canvasRef.current) return;
      if (spreadMode && canvasRef2.current) {
        const leftPage =
          effectiveDirection === 'rtl' ? currentPage + 1 : currentPage;
        const rightPage =
          effectiveDirection === 'rtl' ? currentPage : currentPage + 1;
        if (leftPage >= 1 && leftPage <= pdfDocument.numPages) {
          renderPage(pdfDocument, leftPage, canvasRef.current, renderTaskRef, 0.5);
        }
        if (rightPage >= 1 && rightPage <= pdfDocument.numPages && canvasRef2.current) {
          renderPage(pdfDocument, rightPage, canvasRef2.current, renderTaskRef2, 0.5);
        }
      } else {
        renderPage(pdfDocument, currentPage, canvasRef.current, renderTaskRef);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, renderPage]);

  // Navigation helpers
  const pageStep = spreadMode ? 2 : 1;

  const goNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + pageStep, totalPages));
  }, [pageStep, totalPages]);

  const goPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - pageStep, 1));
  }, [pageStep]);

  // Overlay auto-hide
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlayVisible(false), 3000);
  }, []);

  // Show overlay on page change
  useEffect(() => {
    showOverlay();
  }, [currentPage, showOverlay]);

  // Auto-save reading progress (debounced)
  useEffect(() => {
    if (!profileId) return;
    const timer = setTimeout(() => {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, volumeId: Number(volumeId), currentPage }),
      }).catch((err) => console.error('Failed to save progress:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [profileId, volumeId, currentPage]);

  // Hide overlay after initial display
  useEffect(() => {
    const timer = setTimeout(() => setOverlayVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  }, [effectiveDirection, goNextPage, goPrevPage]);

  // Touch swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // Only trigger if horizontal swipe is dominant and exceeds threshold
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

      e.preventDefault();

      if (dx < 0) {
        // Swiped left
        if (effectiveDirection === 'rtl') goNextPage();
        else goPrevPage();
      } else {
        // Swiped right
        if (effectiveDirection === 'rtl') goPrevPage();
        else goNextPage();
      }
    },
    [effectiveDirection, goNextPage, goPrevPage]
  );

  const handleContainerClick = useCallback(() => {
    showOverlay();
  }, [showOverlay]);

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
      onTouchEnd={handleTouchEnd}
      onClick={handleContainerClick}
      tabIndex={0}
    >
      {/* Canvas area */}
      <div className="flex items-center justify-center w-full h-full">
        {spreadMode ? (
          <div className="flex items-center justify-center h-full gap-0">
            <canvas ref={canvasRef} className="max-h-full" />
            <canvas ref={canvasRef2} className="max-h-full" />
          </div>
        ) : (
          <canvas ref={canvasRef} className="max-h-full max-w-full" />
        )}
      </div>

      {/* Spread mode toggle (desktop only) */}
      {isWideViewport && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSpreadMode((v) => !v);
          }}
          className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-md backdrop-blur-sm transition-colors cursor-pointer"
          title={spreadMode ? 'Single page mode' : 'Two-page spread'}
        >
          {spreadMode ? '1 Page' : '2 Pages'}
        </button>
      )}

      {/* Page indicator overlay */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-black/70 text-white text-sm rounded-lg backdrop-blur-sm transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {spreadMode && currentPage + 1 <= totalPages
          ? `Pages ${currentPage}-${currentPage + 1} of ${totalPages}`
          : `Page ${currentPage} of ${totalPages}`}
      </div>
    </div>
  );
}
