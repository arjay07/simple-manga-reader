'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PageScrubBarProps {
  currentPage: number;
  totalPages: number;
  pdfDocument: PDFDocumentProxy | null;
  onPageChange: (page: number) => void;
  direction: 'ltr' | 'rtl';
}

export default function PageScrubBar({
  currentPage,
  totalPages,
  pdfDocument,
  onPageChange,
  direction,
}: PageScrubBarProps) {
  const isRtl = direction === 'rtl';
  const barRef = useRef<HTMLDivElement>(null);
  const thumbnailCacheRef = useRef<Map<number, string>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPage, setHoverPage] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const renderingPageRef = useRef<number | null>(null);

  // During drag/hover, show the scrubbed position; otherwise show the actual page
  const displayPage = isDragging && hoverPage !== null ? hoverPage : currentPage;
  const progress = totalPages > 1 ? (displayPage - 1) / (totalPages - 1) : 0;

  const pageFromX = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || totalPages < 1) return 1;
      const rect = bar.getBoundingClientRect();
      let ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (isRtl) ratio = 1 - ratio;
      return Math.max(1, Math.min(totalPages, Math.round(ratio * (totalPages - 1)) + 1));
    },
    [totalPages, isRtl]
  );

  // Render thumbnail for a given page
  const renderThumbnail = useCallback(
    async (pageNum: number) => {
      if (!pdfDocument) return;

      const cached = thumbnailCacheRef.current.get(pageNum);
      if (cached) {
        setThumbnailSrc(cached);
        setThumbnailLoading(false);
        return;
      }

      renderingPageRef.current = pageNum;
      setThumbnailLoading(true);

      try {
        const page = await pdfDocument.getPage(pageNum);
        if (renderingPageRef.current !== pageNum) return;

        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 150;
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({ canvas, viewport: scaledViewport }).promise;
        if (renderingPageRef.current !== pageNum) return;

        const dataUrl = canvas.toDataURL();
        thumbnailCacheRef.current.set(pageNum, dataUrl);
        setThumbnailSrc(dataUrl);
        setThumbnailLoading(false);
      } catch {
        // render cancelled or failed
        if (renderingPageRef.current === pageNum) {
          setThumbnailLoading(false);
        }
      }
    },
    [pdfDocument]
  );

  // Update thumbnail when hover page changes
  useEffect(() => {
    if (hoverPage !== null) {
      renderThumbnail(hoverPage);
    } else {
      setThumbnailSrc(null);
      setThumbnailLoading(false);
      renderingPageRef.current = null;
    }
  }, [hoverPage, renderThumbnail]);

  // Mouse hover (no click)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      const page = pageFromX(e.clientX);
      setHoverPage(page);
      setHoverX(e.clientX);
    },
    [isDragging, pageFromX]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverPage(null);
    }
  }, [isDragging]);

  // Click to jump
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      e.stopPropagation();
      const page = pageFromX(e.clientX);
      onPageChange(page);
    },
    [isDragging, pageFromX, onPageChange]
  );

  // Mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      const page = pageFromX(e.clientX);
      setHoverPage(page);
      setHoverX(e.clientX);
    },
    [pageFromX]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const page = pageFromX(e.clientX);
      setHoverPage(page);
      setHoverX(e.clientX);
    };

    const handleUp = (e: MouseEvent) => {
      const page = pageFromX(e.clientX);
      setIsDragging(false);
      setHoverPage(null);
      onPageChange(page);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, pageFromX, onPageChange]);

  // Touch drag
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      const touch = e.touches[0];
      const page = pageFromX(touch.clientX);
      setHoverPage(page);
      setHoverX(touch.clientX);
    },
    [pageFromX]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      const page = pageFromX(touch.clientX);
      setHoverPage(page);
      setHoverX(touch.clientX);
    },
    [pageFromX]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      const page = pageFromX(touch.clientX);
      setIsDragging(false);
      setHoverPage(null);
      onPageChange(page);
    },
    [pageFromX, onPageChange]
  );

  // Calculate tooltip position relative to the bar
  const tooltipLeft = (() => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return hoverX - rect.left;
  })();

  return (
    <div
      ref={barRef}
      className="absolute bottom-full left-3 right-3 h-8 flex items-end cursor-pointer group overflow-visible"
      style={{ touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Thumbnail tooltip */}
      {hoverPage !== null && (
        <div
          className="absolute bottom-full mb-2 flex flex-col items-center pointer-events-none"
          style={{
            left: `${tooltipLeft}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="rounded-lg overflow-hidden shadow-lg bg-black/90 border border-white/20">
            {thumbnailLoading || !thumbnailSrc ? (
              <div className="w-[120px] h-[170px] bg-white/10 animate-pulse" />
            ) : (
              <img
                src={thumbnailSrc}
                alt={`Page ${hoverPage}`}
                className="w-[120px] h-auto"
              />
            )}
          </div>
          <span className="mt-1 px-2 py-0.5 rounded bg-black/90 text-white text-xs font-medium whitespace-nowrap">
            Page {hoverPage}
          </span>
        </div>
      )}

      {/* Track */}
      <div className="absolute bottom-0 left-0 right-0 h-1 group-hover:h-2 transition-all duration-150 bg-white/20 rounded-full mx-2">
        {/* Progress fill */}
        <div
          className={`absolute top-0 h-full bg-white/70 rounded-full transition-[width] duration-100 ${isRtl ? 'right-0' : 'left-0'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {/* Draggable handle - outside track so it can't be clipped */}
      <div
        className="absolute z-10 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 mx-2"
        style={{
          bottom: '-3px',
          [isRtl ? 'right' : 'left']: `${progress * 100}%`,
          transform: `translateX(${isRtl ? '50%' : '-50%'})`,
        }}
      />
    </div>
  );
}
