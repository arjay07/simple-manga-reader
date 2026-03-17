'use client';

import { useVolumeProgress } from '@/components/Library/VolumeProgress';
import { VolumeGrid } from '@/components/Library/VolumeGrid';
import { CoverImage } from './CoverImage';
import { SeriesContinueButton } from './SeriesContinueButton';
import { SeriesProgressBar } from './SeriesProgressBar';

interface Volume {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  page_count: number | null;
}

interface Series {
  id: number;
  title: string;
  folder_name: string;
  cover_path: string | null;
  author: string | null;
  description: string | null;
}

export function SeriesClientContent({
  series,
  volumes,
}: {
  series: Series;
  volumes: Volume[];
}) {
  const progressMap = useVolumeProgress();

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full max-w-[240px] shrink-0">
          <CoverImage series={series} />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{series.title}</h1>
          {series.author && (
            <p className="mt-1 text-muted">{series.author}</p>
          )}
          {series.description && (
            <p className="mt-3 text-sm text-foreground/80">{series.description}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            {volumes.length} {volumes.length === 1 ? 'volume' : 'volumes'}
          </p>

          {volumes.length > 0 && (
            <div className="mt-4 space-y-3">
              <SeriesContinueButton
                seriesId={series.id}
                volumes={volumes}
                progressMap={progressMap}
              />
              <SeriesProgressBar
                volumes={volumes}
                progressMap={progressMap}
              />
            </div>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Volumes</h2>
        {volumes.length === 0 ? (
          <p className="text-muted">No volumes found for this series.</p>
        ) : (
          <VolumeGrid seriesId={series.id} volumes={volumes} progressMap={progressMap} />
        )}
      </section>
    </>
  );
}
