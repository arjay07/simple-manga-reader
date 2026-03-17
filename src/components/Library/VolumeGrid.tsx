'use client';

import Link from 'next/link';
import { VolumeThumbnail } from './VolumeThumbnail';
import { VolumeProgressBar, useVolumeProgress, type ProgressMap } from './VolumeProgress';
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
  progressMap: externalProgressMap,
}: {
  seriesId: number;
  volumes: Volume[];
  progressMap?: ProgressMap;
}) {
  const internalProgressMap = useVolumeProgress();
  const progressMap = externalProgressMap ?? internalProgressMap;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {volumes.map((volume) => {
        const progress = progressMap[volume.id];
        const href = `/read/${seriesId}/${volume.id}`;

        const isComplete =
          progress != null &&
          volume.page_count != null &&
          progress.current_page >= volume.page_count;

        return (
          <Link
            key={volume.id}
            href={href}
            className="group relative rounded-lg border border-border bg-surface p-4 transition-all duration-200 hover:border-accent hover:shadow-md"
          >
            {isComplete && (
              <span className="absolute top-2 right-2 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
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
