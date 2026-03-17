'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useProfile } from '@/components/ProfileProvider';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { parseReaderSettings, type ReaderSettings } from '@/lib/reader-settings';
import ReaderToolbar from './ReaderToolbar';
import ReaderBottomBar from './ReaderBottomBar';
import ReaderSettingsModal from './ReaderSettingsModal';
import VerticalScrollView from './VerticalScrollView';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface MangaReaderProps {
  seriesId: string;
  volumeId: string;
  initialPage?: number;
  profileId?: number;
  title?: string;
  initialSettings?: string;
  fallbackDirection?: string;
}

export default function MangaReader({
  seriesId,
  volumeId,
  initialPage = 1,
  profileId,
  title = '',
  initialSettings,
  fallbackDirection,
}: MangaReaderProps) {
  const { profile } = useProfile();

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
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const renderTaskRef2 = useRef<{ cancel: () => void } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    return () => { cancelled = true; };
  }, [seriesId, volumeId]);

  // Render a single page onto a canvas (paginated mode only)
  const renderPage = useCallback(
    async (
      doc: PDFDocumentProxy,
      pageNum: number,
      canvas: HTMLCanvasElement,
      taskRef: React.MutableRefObject<{ cancel: () => void } | null>,
      widthFraction: number = 1
    ) => {
      if (pageNum < 1 || pageNum > doc.numPages) return;

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
      const scale = Math.min(scaleW, scaleH);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

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

  // Render current page(s) in paginated mode
  useEffect(() => {
    if (isVertical || !pdfDocument || !canvasRef.current) return;

    if (spreadMode && canvasRef2.current) {
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
      renderPage(pdfDocument, currentPage, canvasRef.current, renderTaskRef);
    }
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, isVertical, renderPage]);

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
        renderPage(pdfDocument, currentPage, canvasRef.current, renderTaskRef);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pdfDocument, currentPage, spreadMode, effectiveDirection, isVertical, renderPage]);

  // Navigation helpers
  const pageStep = spreadMode ? 2 : 1;

  const goNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + pageStep, totalPages));
  }, [pageStep, totalPages]);

  const goPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - pageStep, 1));
  }, [pageStep]);

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

  // Touch swipe handling (disabled in vertical mode)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || isVertical) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

      e.preventDefault();

      if (dx < 0) {
        // Swipe left → next page in LTR, prev page in RTL
        if (effectiveDirection === 'rtl') goPrevPage();
        else goNextPage();
      } else {
        // Swipe right → prev page in LTR, next page in RTL
        if (effectiveDirection === 'rtl') goNextPage();
        else goPrevPage();
      }
    },
    [effectiveDirection, isVertical, goNextPage, goPrevPage]
  );

  // Tap handler with tap-to-turn zone detection
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (settingsModalOpen) return;

      if (settings.tapToTurn && !isVertical) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const ratio = x / width;

        // Left 25%, center 50%, right 25%
        if (ratio < 0.25) {
          // Left zone
          if (effectiveDirection === 'rtl') goNextPage();
          else goPrevPage();
          return;
        } else if (ratio > 0.75) {
          // Right zone
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

  // Handle page change from vertical scroll view
  const handleVerticalPageChange = useCallback((page: number) => {
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
      onTouchEnd={handleTouchEnd}
      onClick={handleContainerClick}
      tabIndex={0}
    >
      {/* Reading area */}
      {isVertical && pdfDocument ? (
        <VerticalScrollView
          pdfDocument={pdfDocument}
          totalPages={totalPages}
          onPageChange={handleVerticalPageChange}
        />
      ) : (
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
      />

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
