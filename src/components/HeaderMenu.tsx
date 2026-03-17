'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAdmin } from './AdminProvider';

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, toggleAdmin } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function handleRescan() {
    setScanning(true);
    try {
      const res = await fetch('/api/manga/scan', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setScanning(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg p-2 transition-colors hover:bg-surface-elevated"
        aria-label="Menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg z-50">
          <button
            onClick={() => {
              toggleAdmin();
            }}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors rounded-t-lg"
          >
            <span>Admin Mode</span>
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${
                isAdmin ? 'bg-accent' : 'bg-border'
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  isAdmin ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          <button
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
          >
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleRescan}
            disabled={scanning}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors rounded-b-lg disabled:opacity-50"
          >
            <span>{scanning ? 'Scanning...' : 'Rescan Library'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
