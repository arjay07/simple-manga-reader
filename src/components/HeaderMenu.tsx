'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAdmin } from './AdminProvider';
import { useProfile } from './ProfileProvider';
import { apiUrl } from '@/lib/basePath';

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showDirInput, setShowDirInput] = useState(false);
  const [mangaDir, setMangaDir] = useState('');
  const [dirError, setDirError] = useState('');
  const [savingDir, setSavingDir] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, toggleAdmin } = useAdmin();
  const { profile } = useProfile();
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
      const res = await fetch(apiUrl('/api/manga/scan'), { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setScanning(false);
      setOpen(false);
    }
  }

  async function handleOpenDirSetting() {
    setShowDirInput(true);
    setDirError('');
    try {
      const res = await fetch(apiUrl('/api/settings'));
      if (res.ok) {
        const data = await res.json();
        setMangaDir(data.manga_dir ?? '');
      }
    } catch { /* ignore */ }
  }

  async function handleSaveDir() {
    setSavingDir(true);
    setDirError('');
    try {
      const res = await fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manga_dir: mangaDir }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDirError(data.error ?? 'Failed to save');
        return;
      }
      setShowDirInput(false);
      setOpen(false);
      router.refresh();
    } finally {
      setSavingDir(false);
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
              setOpen(false);
              router.push('/');
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors rounded-t-lg"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm">
              {profile?.avatar ?? (profile?.name?.[0]?.toUpperCase() ?? '?')}
            </span>
            <span className="truncate">{profile?.name ?? 'Switch Profile'}</span>
          </button>
          <div className="border-t border-border" />
          <button
            onClick={() => {
              toggleAdmin();
            }}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
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

          {isAdmin && (
            <>
              <button
                onClick={handleOpenDirSetting}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
              >
                <span>Manga Folder</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              {showDirInput && (
                <div className="px-4 py-2.5 border-t border-border">
                  <input
                    type="text"
                    value={mangaDir}
                    onChange={(e) => setMangaDir(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDir(); }}
                    className="w-full rounded bg-background border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                    placeholder="/path/to/manga"
                  />
                  {dirError && (
                    <p className="mt-1 text-xs text-red-500">{dirError}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleSaveDir}
                      disabled={savingDir}
                      className="flex-1 rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent/90 disabled:opacity-50"
                    >
                      {savingDir ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setShowDirInput(false)}
                      className="flex-1 rounded bg-surface-elevated px-2 py-1 text-xs text-foreground hover:bg-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/admin/panel-detect');
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
              >
                <span>Panel Detection</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/admin/panel-jobs');
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
              >
                <span>Panel Jobs</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            </>
          )}

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
