'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/components/ProfileProvider';

export interface ProgressMap {
  [volumeId: number]: { current_page: number; page_count: number | null; updated_at: string };
}

interface ProgressEntry {
  volume_id: number;
  current_page: number;
  page_count: number | null;
  updated_at: string;
}

export function useVolumeProgress() {
  const { profile } = useProfile();
  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  useEffect(() => {
    if (!profile) return;

    fetch(`/api/progress?profileId=${profile.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data: ProgressEntry[]) => {
        const map: ProgressMap = {};
        for (const entry of data) {
          map[entry.volume_id] = {
            current_page: entry.current_page,
            page_count: entry.page_count,
            updated_at: entry.updated_at,
          };
        }
        setProgressMap(map);
      })
      .catch(() => setProgressMap({}));
  }, [profile]);

  return progressMap;
}

export function VolumeProgressBar({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const percent = Math.min((currentPage / totalPages) * 100, 100);

  return (
    <div className="mt-2">
      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">{currentPage} / {totalPages}</p>
    </div>
  );
}
