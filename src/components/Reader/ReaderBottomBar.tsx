'use client';

import { useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import PageScrubBar from './PageScrubBar';
import PageSelectorDropdown from './PageSelectorDropdown';

interface ReaderBottomBarProps {
  visible: boolean;
  currentPage: number;
  totalPages: number;
  spreadMode: boolean;
  pdfDocument: PDFDocumentProxy | null;
  onPageChange: (page: number) => void;
  isVertical: boolean;
  direction: 'ltr' | 'rtl';
}

export default function ReaderBottomBar({
  visible,
  currentPage,
  totalPages,
  spreadMode,
  pdfDocument,
  onPageChange,
  isVertical,
  direction,
}: ReaderBottomBarProps) {
  const isRtl = direction === 'rtl';
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const pageText = spreadMode && currentPage + 1 <= totalPages
    ? `Pages ${currentPage}-${currentPage + 1} / ${totalPages}`
    : `Page ${currentPage} / ${totalPages}`;

  const progress = totalPages > 1 ? (currentPage - 1) / (totalPages - 1) : 0;

  const toggleDropdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen((v) => !v);
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      onPageChange(page);
    },
    [onPageChange]
  );

  return (
    <>
      {/* Thin persistent progress line - always visible in paginated mode */}
      {!isVertical && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 h-[2px] transition-opacity duration-300 ${
            visible ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div
            className={`h-full bg-white/50 transition-[width] duration-200 ${isRtl ? 'ml-auto' : ''}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Full bottom bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 overflow-visible transition-transform duration-300 ease-in-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrub bar positioned above the bottom bar */}
        {!isVertical && (
          <div className={visible ? '' : 'pointer-events-none'}>
            <PageScrubBar
              currentPage={currentPage}
              totalPages={totalPages}
              pdfDocument={pdfDocument}
              onPageChange={handlePageChange}
              direction={direction}
            />
          </div>
        )}

        {/* Bottom bar content */}
        <div className="relative flex items-center justify-center px-4 py-3 bg-black/80 backdrop-blur-sm text-white text-sm">
          <button
            onClick={toggleDropdown}
            className="cursor-pointer hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/10"
          >
            {pageText}
          </button>

          {/* Page selector dropdown */}
          <PageSelectorDropdown
            open={dropdownOpen}
            onClose={() => setDropdownOpen(false)}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </>
  );
}
