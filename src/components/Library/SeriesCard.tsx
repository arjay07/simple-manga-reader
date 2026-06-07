'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAdmin } from '@/components/AdminProvider';
import { CoverMenu } from './CoverMenu';
import { apiUrl } from '@/lib/basePath';
import { unitNoun } from '@/lib/unit-label';
import type { SeriesKind } from '@/types';

interface SeriesCardProps {
  id: number;
  title: string;
  coverPath: string | null;
  volumeCount: number;
  kind: SeriesKind;
  mangadexId: string | null;
}

export function SeriesCard({ id, title, coverPath, volumeCount, kind, mangadexId }: SeriesCardProps) {
  const [imgError, setImgError] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);
  const { isAdmin } = useAdmin();

  function handleCoverUpdated() {
    setImgError(false);
    setCacheBust((prev) => prev + 1);
  }

  return (
    <Link
      href={`/library/${id}`}
      className="group block rounded-lg overflow-hidden bg-surface transition-all duration-200 hover:scale-[1.03] hover:shadow-lg"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-elevated">
        {!imgError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={cacheBust}
            src={apiUrl(`/api/manga/${id}/cover?v=${cacheBust}`)}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent/20 p-4">
            <span className="text-center text-sm font-medium text-foreground">{title}</span>
          </div>
        )}
        {isAdmin && (
          <CoverMenu
            target="series"
            seriesId={id}
            mangadexId={mangadexId}
            onUpdated={handleCoverUpdated}
          />
        )}
      </div>
      <div className="p-2">
        <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted">
          {volumeCount} {unitNoun(kind).toLowerCase()}
          {volumeCount === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  );
}
