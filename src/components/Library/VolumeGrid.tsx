'use client';

import Link from 'next/link';
import { VolumeThumbnail } from './VolumeThumbnail';
import { VolumeProgressBar, useVolumeProgress } from './VolumeProgress';
interface Volume {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  page_count: number | null;
}

export function VolumeGrid({
  seriesId,
  volumes,
}: {
  seriesId: number;
  volumes: Volume[];
}) {
  const progressMap = useVolumeProgress();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {volumes.map((volume) => {
        const progress = progressMap[volume.id];
        const href = `/read/${seriesId}/${volume.id}`;

        return (
          <Link
            key={volume.id}
            href={href}
            className="group rounded-lg border border-border bg-surface p-4 transition-all duration-200 hover:border-accent hover:shadow-md"
          >
            <VolumeThumbnail
              seriesId={seriesId}
              volumeId={volume.id}
              volumeNumber={volume.volume_number}
            />
            <h3 className="truncate text-sm font-medium text-foreground">
              {volume.title}
            </h3>
            {volume.volume_number != null && (
              <p className="text-xs text-muted">Vol. {volume.volume_number}</p>
            )}
            {!progress && volume.page_count != null && (
              <p className="text-xs text-muted-foreground">{volume.page_count} pages</p>
            )}
            {progress && volume.page_count != null && (
              <VolumeProgressBar
                currentPage={progress.current_page}
                totalPages={volume.page_count}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
