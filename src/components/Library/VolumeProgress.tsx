'use client';

import { useMemo } from 'react';
import { useProfile } from '@/components/ProfileProvider';
import { useFetch } from '@/hooks/useFetch';
import { apiUrl } from '@/lib/basePath';
import type { ProgressEntry } from '@/types';

export interface ProgressMap {
  [volumeId: number]: { current_page: number; page_count: number | null; updated_at: string };
}

export function useVolumeProgress(): ProgressMap {
  const { profile } = useProfile();
  const url = profile ? apiUrl(`/api/progress?profileId=${profile.id}`) : null;
  const { data } = useFetch<ProgressEntry[]>(url);

  return useMemo(() => {
    if (!data) return {};
    const map: ProgressMap = {};
    for (const entry of data) {
      map[entry.volume_id] = {
        current_page: entry.current_page,
        page_count: entry.page_count,
        updated_at: entry.updated_at,
      };
    }
    return map;
  }, [data]);
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
      <p className="mt-1 text-xs text-muted">
        {currentPage} / {totalPages}
      </p>
    </div>
  );
}
