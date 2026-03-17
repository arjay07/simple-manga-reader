'use client';

import { useEffect, useCallback } from 'react';
import type { ReaderSettings, ReadingDirection, PageMode } from '@/lib/reader-settings';

interface ReaderSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
  isWideViewport: boolean;
}

export default function ReaderSettingsModal({
  open,
  onClose,
  settings,
  onSettingsChange,
  isWideViewport,
}: ReaderSettingsModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  if (!open) return null;

  const isVertical = settings.readingDirection === 'vertical';

  const setDirection = (dir: ReadingDirection) => {
    const updated = { ...settings, readingDirection: dir };
    if (dir === 'vertical') {
      updated.pageMode = 'single';
    }
    onSettingsChange(updated);
  };

  const setTapToTurn = (value: boolean) => {
    onSettingsChange({ ...settings, tapToTurn: value });
  };

  const setPageMode = (mode: PageMode) => {
    onSettingsChange({ ...settings, pageMode: mode });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-neutral-900 text-white rounded-xl p-6 w-[320px] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Reading Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:text-white/70 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Reading Direction */}
        <div className="mb-5">
          <label className="block text-xs text-white/60 mb-2 uppercase tracking-wide">Direction</label>
          <div className="flex rounded-lg overflow-hidden border border-white/20">
            {(['rtl', 'ltr', 'vertical'] as ReadingDirection[]).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  settings.readingDirection === dir
                    ? 'bg-white text-black'
                    : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {dir === 'rtl' ? 'RTL' : dir === 'ltr' ? 'LTR' : 'Vertical'}
              </button>
            ))}
          </div>
        </div>

        {/* Tap to Turn */}
        {!isVertical && (
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/60 uppercase tracking-wide">Tap to Turn Page</label>
              <button
                onClick={() => setTapToTurn(!settings.tapToTurn)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                  settings.tapToTurn ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.tapToTurn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Page Mode */}
        {!isVertical && isWideViewport && (
          <div>
            <label className="block text-xs text-white/60 mb-2 uppercase tracking-wide">Page Mode</label>
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              {(['single', 'spread'] as PageMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPageMode(mode)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    settings.pageMode === mode
                      ? 'bg-white text-black'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {mode === 'single' ? 'Single' : 'Spread'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
