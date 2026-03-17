'use client';

import { useState } from 'react';

interface CoverImageProps {
  series: {
    id: number;
    title: string;
    cover_path: string | null;
  };
}

export function CoverImage({ series }: CoverImageProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-accent/20">
        <span className="px-4 text-center text-lg font-semibold text-foreground">
          {series.title}
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/manga/${series.id}/cover`}
        alt={series.title}
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
