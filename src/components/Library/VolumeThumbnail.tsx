'use client';

import { useState } from 'react';

interface VolumeThumbnailProps {
  seriesId: number;
  volumeId: number;
  volumeNumber: number | null;
}

export function VolumeThumbnail({ seriesId, volumeId, volumeNumber }: VolumeThumbnailProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex aspect-[2/3] items-center justify-center rounded bg-surface-elevated mb-3">
        <span className="text-2xl font-bold text-muted">
          {volumeNumber ?? '#'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded bg-surface-elevated mb-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/manga/${seriesId}/${volumeId}/thumbnail`}
        alt={`Volume ${volumeNumber ?? ''}`}
        className="h-full w-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}
