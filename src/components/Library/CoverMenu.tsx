'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl } from '@/lib/basePath';

export type CoverMenuProps =
  | { target: 'series'; seriesId: number; mangadexId: string | null; onUpdated: () => void }
  | {
      target: 'volume';
      seriesId: number;
      volumeId: number;
      mangadexId: string | null;
      onUpdated: () => void;
    };

export function CoverMenu(props: CoverMenuProps) {
  const { mangadexId, onUpdated } = props;
  const baseUrl =
    props.target === 'series'
      ? `/api/manga/${props.seriesId}/cover`
      : `/api/manga/${props.seriesId}/${props.volumeId}/cover`;
  const webDisabled = mangadexId == null;

  const [open, setOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Panel is rendered via portal to escape overflow-hidden ancestors (volume tile, series card).
  // Coords are page-absolute (include scroll offsets) so the panel stays anchored as the user scrolls.
  const [panelCoords, setPanelCoords] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPanelCoords(null);
      return;
    }

    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setPanelCoords({
        top: rect.bottom + window.scrollY + 4,
        right: document.documentElement.clientWidth - rect.right - window.scrollX,
      });
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideMenu = menuRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideMenu && !insidePanel) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setUrlModalOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function clearError() {
    setTimeout(() => setError(null), 3000);
  }

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const res = await fetch(apiUrl(baseUrl), {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      clearError();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  async function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }
      onUpdated();
      setUrlModalOpen(false);
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      clearError();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  async function handleAutoGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`${baseUrl}/generate`), {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      clearError();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  async function handleAutoGenerateWeb() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`${baseUrl}/generate-web`), {
        method: 'POST',
      });
      if (!res.ok) {
        // Surfaces 404 ("no cover available") and 502 ("MangaDex unreachable") in the red banner.
        const data = await res.json();
        throw new Error(data.error || 'Web fetch failed');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Web fetch failed');
      clearError();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <div className="absolute top-2 right-2 z-10" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
          aria-label="Cover options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {open &&
          panelCoords &&
          typeof document !== 'undefined' &&
          createPortal(
          <div
            ref={panelRef}
            className="absolute w-44 rounded-lg border border-border bg-surface shadow-lg z-50"
            style={{ top: panelCoords.top, right: panelCoords.right }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors rounded-t-lg disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Cover
            </button>
            <button
              onClick={() => {
                setUrlModalOpen(true);
                setOpen(false);
              }}
              disabled={loading}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Set from URL
            </button>
            <button
              onClick={handleAutoGenerate}
              disabled={loading}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Auto-generate
            </button>
            {/* Disabled when the parent series isn't linked to MangaDex; tooltip teaches the fix. */}
            <button
              onClick={webDisabled ? undefined : handleAutoGenerateWeb}
              disabled={loading || webDisabled}
              title={
                webDisabled ? 'Link this series to MangaDex via Fetch Metadata first.' : undefined
              }
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors rounded-b-lg disabled:opacity-50 ${
                webDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Auto-generate from web
            </button>
          </div>,
          document.body,
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />

      {urlModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUrlModalOpen(false);
            }}
          >
            <div
              className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl"
              // preventDefault is required because the menu may live inside a Next.js <Link>;
              // without it, clicks bubble up at the DOM level and trigger anchor navigation.
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
            <h3 className="text-sm font-medium text-foreground mb-3">Set Cover from URL</h3>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/cover.jpg"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
                if (e.key === 'Escape') setUrlModalOpen(false);
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setUrlModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUrlSubmit}
                disabled={loading || !urlInput.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {loading ? 'Downloading...' : 'Set Cover'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {error && (
        <div
          className="absolute bottom-2 left-2 right-2 z-20 rounded bg-red-500/90 px-2 py-1 text-xs text-white"
          onClick={(e) => e.preventDefault()}
        >
          {error}
        </div>
      )}
    </>
  );
}
