'use client';

import { useProfile } from '@/components/ProfileProvider';
import type { ProgressMap } from '@/components/Library/VolumeProgress';

interface Volume {
  id: number;
  page_count: number | null;
}

export function SeriesProgressBar({
  volumes,
  progressMap,
}: {
  volumes: Volume[];
  progressMap: ProgressMap;
}) {
  const { profile } = useProfile();
  if (!profile) return null;

  let totalPages = 0;
  let pagesRead = 0;

  for (const volume of volumes) {
    if (volume.page_count == null) continue;
    totalPages += volume.page_count;
    const progress = progressMap[volume.id];
    if (progress) {
      pagesRead += Math.min(progress.current_page, volume.page_count);
    }
  }

  if (pagesRead === 0 || totalPages === 0) return null;

  const percent = Math.min((pagesRead / totalPages) * 100, 100);

  return (
    <div className="max-w-xs">
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {pagesRead} / {totalPages} pages ({Math.round(percent)}%)
      </p>
    </div>
  );
}
