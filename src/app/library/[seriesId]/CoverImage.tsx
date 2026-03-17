'use client';

import Image from 'next/image';
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
  const imageSrc = series.cover_path ?? `/covers/${series.id}.jpg`;

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
      <Image
        src={imageSrc}
        alt={series.title}
        fill
        className="object-cover"
        sizes="240px"
        priority
        onError={() => setImgError(true)}
      />
    </div>
  );
}
