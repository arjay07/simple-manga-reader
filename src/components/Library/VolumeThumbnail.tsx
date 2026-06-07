'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/basePath';
import { useAdmin } from '@/components/AdminProvider';
import { unitNoun } from '@/lib/unit-label';
import type { SeriesKind } from '@/types';
import { CoverMenu } from './CoverMenu';

interface VolumeThumbnailProps {
  seriesId: number;
  volumeId: number;
  volumeNumber: number | null;
  kind: SeriesKind;
  // Omit to suppress the admin cover menu (used on small surfaces like ContinueReading).
  mangadexId?: string | null;
}

export function VolumeThumbnail({
  seriesId,
  volumeId,
  volumeNumber,
  kind,
  mangadexId,
}: VolumeThumbnailProps) {
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const { isAdmin } = useAdmin();
  const showMenu = mangadexId !== undefined;

  function handleUpdated() {
    setError(false);
    setVersion((prev) => prev + 1);
  }

  if (error && !isAdmin) {
    return (
      <div className="flex aspect-[2/3] items-center justify-center rounded bg-surface-elevated mb-3">
        <span className="text-2xl font-bold text-muted">{volumeNumber ?? '#'}</span>
      </div>
    );
  }

  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded bg-surface-elevated mb-3">
      {!error ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={version}
          // Cache-bust by version so a freshly-uploaded cover re-fetches without a hard reload.
          src={apiUrl(`/api/manga/${seriesId}/${volumeId}/thumbnail?v=${version}`)}
          alt={`${unitNoun(kind)} ${volumeNumber ?? ''}`}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-2xl font-bold text-muted">{volumeNumber ?? '#'}</span>
        </div>
      )}
      {isAdmin && showMenu && (
        <CoverMenu
          target="volume"
          seriesId={seriesId}
          volumeId={volumeId}
          mangadexId={mangadexId ?? null}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
