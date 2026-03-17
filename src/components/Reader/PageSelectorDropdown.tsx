'use client';

import { useRef, useEffect, useCallback } from 'react';

interface PageSelectorDropdownProps {
  open: boolean;
  onClose: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PageSelectorDropdown({
  open,
  onClose,
  currentPage,
  totalPages,
  onPageChange,
}: PageSelectorDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to center current page when dropdown opens
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeItem = listRef.current.querySelector('[data-active="true"]');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center' });
    }
  }, [open, currentPage]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay adding the listener to avoid catching the toggle click
    const id = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handleClick);
    };
  }, [open, onClose]);

  const handlePageClick = useCallback(
    (page: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onPageChange(page);
      onClose();
    },
    [onPageChange, onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 max-h-64 overflow-y-auto rounded-lg bg-black/90 backdrop-blur-sm border border-white/20 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={listRef} className="py-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            data-active={page === currentPage ? 'true' : undefined}
            onClick={(e) => handlePageClick(page, e)}
            className={`w-full px-4 py-1.5 text-sm text-left cursor-pointer transition-colors ${
              page === currentPage
                ? 'bg-white/20 text-white font-medium'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Page {page}
          </button>
        ))}
      </div>
    </div>
  );
}
