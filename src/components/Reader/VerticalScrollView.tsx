'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface VerticalScrollViewProps {
  pdfDocument: PDFDocumentProxy;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function VerticalScrollView({ pdfDocument, totalPages, onPageChange }: VerticalScrollViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderedPages = useRef<Set<number>>(new Set());

  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (renderedPages.current.has(pageNum)) return;
      renderedPages.current.add(pageNum);

      const page = await pdfDocument.getPage(pageNum);
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      try {
        await page.render({ canvas, viewport: scaledViewport }).promise;
      } catch {
        // render cancelled
      }
    },
    [pdfDocument]
  );

  // Render all pages
  useEffect(() => {
    renderedPages.current.clear();
    const canvases = canvasRefs.current;
    for (let i = 0; i < totalPages; i++) {
      const canvas = canvases[i];
      if (canvas) {
        renderPage(i + 1, canvas);
      }
    }
  }, [pdfDocument, totalPages, renderPage]);

  // Track current page via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisiblePage = 1;
        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageNum = Number(entry.target.getAttribute('data-page'));
            if (pageNum) mostVisiblePage = pageNum;
          }
        }
        if (maxRatio > 0) {
          onPageChange(mostVisiblePage);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const canvases = canvasRefs.current;
    for (const canvas of canvases) {
      if (canvas) observer.observe(canvas);
    }

    return () => observer.disconnect();
  }, [totalPages, onPageChange]);

  // Re-render on resize
  useEffect(() => {
    const onResize = () => {
      renderedPages.current.clear();
      const canvases = canvasRefs.current;
      for (let i = 0; i < totalPages; i++) {
        const canvas = canvases[i];
        if (canvas) renderPage(i + 1, canvas);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pdfDocument, totalPages, renderPage]);

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
