'use client';

import Link from 'next/link';
import { useVolumeProgress, type ProgressMap } from './VolumeProgress';
import { unitLabel } from '@/lib/unit-label';
import type { SeriesKind, Volume } from '@/types';

/**
 * Compact list rendering of a chapter series' reading units. Volumes use the
 * cover-tile grid ({@link VolumeGrid}); chapters read better as rows, the way
 * scanlation readers list them.
 */
export function ChapterList({
  seriesId,
  kind,
  volumes,
  progressMap: externalProgressMap,
}: {
  seriesId: number;
  kind: SeriesKind;
  volumes: Volume[];
  progressMap?: ProgressMap;
}) {
  const internalProgressMap = useVolumeProgress();
  const progressMap = externalProgressMap ?? internalProgressMap;

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {volumes.map((volume, i) => {
        const progress = progressMap[volume.id];
        const href = `/read/${seriesId}/${volume.id}`;
        const total = volume.page_count;
        const isComplete = progress != null && total != null && progress.current_page >= total;
        const inProgress = progress != null && !isComplete;
        const percent =
          inProgress && total != null ? Math.min((progress.current_page / total) * 100, 100) : 0;

        const status = isComplete
          ? 'Completed'
          : inProgress && total != null
            ? `Page ${Math.min(progress.current_page, total)} of ${total}`
            : total != null
              ? `${total} pages`
              : null;

        return (
          <li key={volume.id}>
            <Link
              href={href}
              className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-elevated sm:px-4"
            >
              {/* Leading index chip */}
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                  isComplete
                    ? 'bg-accent/15 text-accent'
                    : 'bg-surface-elevated text-muted group-hover:bg-background'
                }`}
              >
                {volume.volume_number ?? i + 1}
              </span>

              {/* Label + status */}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {unitLabel(kind, volume.volume_number)}
                  </span>
                  {isComplete && <CheckIcon />}
                </span>
                {status && (
                  <span
                    className={`mt-0.5 block text-xs ${isComplete ? 'text-accent' : 'text-muted'}`}
                  >
                    {status}
                  </span>
                )}
                {inProgress && total != null && (
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-accent transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                )}
              </span>

              {/* Trailing chevron */}
              <ChevronIcon />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-muted"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
