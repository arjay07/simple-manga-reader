'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface EndOfVolumeOverlayProps {
  seriesId: string;
  direction: 'end' | 'start';
  nextVolumeId?: string;
  nextVolumeTitle?: string;
  prevVolumeId?: string;
  prevVolumeTitle?: string;
  onDismiss: () => void;
}

export default function EndOfVolumeOverlay({
  seriesId,
  direction,
  nextVolumeId,
  nextVolumeTitle,
  prevVolumeId,
  prevVolumeTitle,
  onDismiss,
}: EndOfVolumeOverlayProps) {
  const router = useRouter();

  const isEnd = direction === 'end';
  const targetId = isEnd ? nextVolumeId : prevVolumeId;
  const targetTitle = isEnd ? nextVolumeTitle : prevVolumeTitle;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center pb-24"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center text-white backdrop-blur-xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {isEnd && !targetId && (
          <>
            <div className="mb-2 text-2xl">&#10003;</div>
            <h3 className="mb-1 text-lg font-semibold">Series Complete</h3>
            <p className="mb-5 text-sm text-white/60">
              You&apos;ve finished the last volume.
            </p>
          </>
        )}

        {isEnd && targetId && (
          <>
            <p className="mb-1 text-sm text-white/60">Up next</p>
            <h3 className="mb-5 text-lg font-semibold">{targetTitle}</h3>
          </>
        )}

        {!isEnd && targetId && (
          <>
            <p className="mb-1 text-sm text-white/60">Previous volume</p>
            <h3 className="mb-5 text-lg font-semibold">{targetTitle}</h3>
          </>
        )}

        <div className="flex flex-col gap-3">
          {targetId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/read/${seriesId}/${targetId}`);
              }}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/80 cursor-pointer"
            >
              {isEnd ? 'Continue Reading' : 'Go to Previous Volume'}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/library/${seriesId}`);
            }}
            className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/20 cursor-pointer"
          >
            Back to Series
          </button>
        </div>
      </div>
    </div>
  );
}
