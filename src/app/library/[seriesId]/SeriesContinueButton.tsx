'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/ProfileProvider';
import type { ProgressMap } from '@/components/Library/VolumeProgress';

interface Volume {
  id: number;
  volume_number: number | null;
  page_count: number | null;
}

function getReadingDestination(
  volumes: Volume[],
  progressMap: ProgressMap,
): { volumeId: number; page: number; volumeNumber: number | null; label: 'start' | 'continue' } | null {
  if (volumes.length === 0) return null;

  // Find volume with most recent progress in this series
  const seriesVolumeIds = new Set(volumes.map((v) => v.id));
  let mostRecent: { volumeId: number; currentPage: number; updatedAt: string } | null = null;

  for (const [vidStr, progress] of Object.entries(progressMap)) {
    const vid = Number(vidStr);
    if (!seriesVolumeIds.has(vid)) continue;
    if (!mostRecent || progress.updated_at > mostRecent.updatedAt) {
      mostRecent = { volumeId: vid, currentPage: progress.current_page, updatedAt: progress.updated_at };
    }
  }

  // No progress — start reading from volume 1
  if (!mostRecent) {
    const first = volumes[0];
    return { volumeId: first.id, page: 1, volumeNumber: first.volume_number, label: 'start' };
  }

  const currentVolume = volumes.find((v) => v.id === mostRecent!.volumeId);
  if (!currentVolume) {
    const first = volumes[0];
    return { volumeId: first.id, page: 1, volumeNumber: first.volume_number, label: 'start' };
  }

  // Check if current volume is finished
  const isFinished =
    currentVolume.page_count != null && mostRecent.currentPage >= currentVolume.page_count;

  if (isFinished) {
    // Find next volume in order
    const currentIdx = volumes.indexOf(currentVolume);
    const nextVolume = volumes[currentIdx + 1];
    if (nextVolume) {
      return { volumeId: nextVolume.id, page: 1, volumeNumber: nextVolume.volume_number, label: 'continue' };
    }
    // All done — point to last page of last volume
    return {
      volumeId: currentVolume.id,
      page: mostRecent.currentPage,
      volumeNumber: currentVolume.volume_number,
      label: 'continue',
    };
  }

  // Partial progress — continue where left off
  return {
    volumeId: currentVolume.id,
    page: mostRecent.currentPage,
    volumeNumber: currentVolume.volume_number,
    label: 'continue',
  };
}

export function SeriesContinueButton({
  seriesId,
  volumes,
  progressMap,
}: {
  seriesId: number;
  volumes: Volume[];
  progressMap: ProgressMap;
}) {
  const { profile } = useProfile();
  const router = useRouter();

  if (volumes.length === 0) return null;

  const handleNoProfile = () => {
    router.push('/');
  };

  // No profile — show Start Reading, redirect to profile selector on click
  if (!profile) {
    return (
      <button
        onClick={handleNoProfile}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        <PlayIcon />
        Start Reading
      </button>
    );
  }

  const destination = getReadingDestination(volumes, progressMap);
  if (!destination) return null;

  const isStart = destination.label === 'start';
  const href = `/read/${seriesId}/${destination.volumeId}`;

  const subtitle =
    destination.label === 'continue' && destination.volumeNumber != null
      ? destination.page > 1
        ? `Vol. ${destination.volumeNumber} \u00B7 Page ${destination.page}`
        : `Vol. ${destination.volumeNumber}`
      : null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
    >
      <PlayIcon />
      <span className="flex flex-col items-start leading-tight">
        <span>{isStart ? 'Start Reading' : 'Continue Reading'}</span>
        {subtitle && (
          <span className="text-xs font-normal text-white/70">{subtitle}</span>
        )}
      </span>
    </Link>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}
