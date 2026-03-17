'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAdmin } from '@/components/AdminProvider';
import { SeriesCardMenu } from './SeriesCardMenu';

interface SeriesCardProps {
  id: number;
  title: string;
  coverPath: string | null;
  volumeCount: number;
}

export function SeriesCard({ id, title, coverPath, volumeCount }: SeriesCardProps) {
  const [imgError, setImgError] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);
  const { isAdmin } = useAdmin();
  const imageSrc = coverPath ?? `/covers/${id}.jpg`;

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
          <Image
            key={cacheBust}
            src={imageSrc}
            alt={title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent/20 p-4">
            <span className="text-center text-sm font-medium text-foreground">
              {title}
            </span>
          </div>
        )}
        {isAdmin && (
          <SeriesCardMenu seriesId={id} onCoverUpdated={handleCoverUpdated} />
        )}
      </div>
      <div className="p-2">
        <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted">
          {volumeCount} {volumeCount === 1 ? 'volume' : 'volumes'}
        </p>
      </div>
    </Link>
  );
}
