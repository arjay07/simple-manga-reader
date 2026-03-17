'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const BUFFER_PAGES = 3;
const RESIZE_DEBOUNCE_MS = 300;

interface VerticalScrollViewProps {
  pdfDocument: PDFDocumentProxy;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function VerticalScrollView({ pdfDocument, totalPages, onPageChange }: VerticalScrollViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderedPages = useRef<Set<number>>(new Set());
  const visiblePages = useRef<Set<number>>(new Set());
  const aspectRatio = useRef<number>(1.4); // default until measured

  // Measure page 1 aspect ratio and set all placeholder dimensions
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const page = await pdfDocument.getPage(1);
      if (cancelled) return;

      const vp = page.getViewport({ scale: 1 });
      aspectRatio.current = vp.height / vp.width;
      applyPlaceholderSizes();
    }

    init();
    return () => { cancelled = true; };
  }, [pdfDocument, totalPages]);

  // Apply placeholder dimensions to all canvases based on stored aspect ratio
  const applyPlaceholderSizes = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = Math.round(width * aspectRatio.current);

    for (const canvas of canvasRefs.current) {
      if (canvas && !renderedPages.current.has(Number(canvas.dataset.page))) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    }
  }, []);

  // Render a single page onto its canvas
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (renderedPages.current.has(pageNum)) return;
      renderedPages.current.add(pageNum);

      const page = await pdfDocument.getPage(pageNum);
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const vp = page.getViewport({ scale: 1 });
      const scale = containerWidth / vp.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      try {
        await page.render({ canvas, viewport: scaledViewport }).promise;
      } catch {
        // render cancelled
      }
    },
    [pdfDocument]
  );

  // Clear a rendered page canvas back to placeholder dimensions
  const clearPage = useCallback((pageNum: number, canvas: HTMLCanvasElement) => {
    if (!renderedPages.current.has(pageNum)) return;
    renderedPages.current.delete(pageNum);

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = Math.round(width * aspectRatio.current);

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  // IntersectionObserver for lazy rendering + page tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Compute rootMargin based on buffer: approximate page height × BUFFER_PAGES
    const pageHeight = container.clientWidth * aspectRatio.current;
    const margin = Math.round(pageHeight * BUFFER_PAGES);

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisiblePage = 1;

        for (const entry of entries) {
          const pageNum = Number(entry.target.getAttribute('data-page'));
          if (!pageNum) continue;
          const canvas = entry.target as HTMLCanvasElement;

          if (entry.isIntersecting) {
            visiblePages.current.add(pageNum);
            renderPage(pageNum, canvas);
          } else {
            visiblePages.current.delete(pageNum);
            clearPage(pageNum, canvas);
          }

          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pageNum;
          }
        }

        if (maxRatio > 0) {
          onPageChange(mostVisiblePage);
        }
      },
      {
        root: container,
        rootMargin: `${margin}px 0px ${margin}px 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const canvases = canvasRefs.current;
    for (const canvas of canvases) {
      if (canvas) observer.observe(canvas);
    }

    return () => observer.disconnect();
  }, [pdfDocument, totalPages, onPageChange, renderPage, clearPage]);

  // Debounced resize: update placeholders and re-render buffered pages only
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Clear all rendered state so pages re-render at new size
        renderedPages.current.clear();
        applyPlaceholderSizes();

        // Re-render only pages currently in the buffer
        for (const pageNum of visiblePages.current) {
          const canvas = canvasRefs.current[pageNum - 1];
          if (canvas) renderPage(pageNum, canvas);
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [pdfDocument, totalPages, renderPage, applyPlaceholderSizes]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
    >
      <div className="flex flex-col items-center">
        {Array.from({ length: totalPages }, (_, i) => (
          <canvas
            key={i}
            ref={(el) => { canvasRefs.current[i] = el; }}
            data-page={i + 1}
            className="w-full max-w-full"
          />
        ))}
      </div>
    </div>
  );
}
