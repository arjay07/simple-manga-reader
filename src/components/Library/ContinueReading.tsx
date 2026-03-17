'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProfile } from '@/components/ProfileProvider';
import { VolumeThumbnail } from './VolumeThumbnail';

interface ProgressEntry {
  volume_id: number;
  current_page: number;
  page_count: number | null;
  volume_title: string;
  volume_number: number;
  series_id: number;
  series_title: string;
  updated_at: string;
}

export function ContinueReading() {
  const { profile } = useProfile();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    if (!profile) return;

    fetch(`/api/progress?profileId=${profile.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch progress');
        return res.json();
      })
      .then((data: ProgressEntry[]) => {
        setEntries(data.slice(0, 6));
      })
      .catch(() => {
        setEntries([]);
      });
  }, [profile]);

  if (!profile || entries.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Continue Reading</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {entries.map((entry) => (
          <Link
            key={entry.volume_id}
            href={`/read/${entry.series_id}/${entry.volume_id}`}
            className="flex-shrink-0 w-36 rounded-lg bg-surface overflow-hidden transition-colors hover:bg-surface-elevated"
          >
            <VolumeThumbnail
              seriesId={entry.series_id}
              volumeId={entry.volume_id}
              volumeNumber={entry.volume_number}
            />
            <div className="px-3 pb-3">
              <p className="truncate text-sm font-medium text-foreground">
                {entry.series_title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Vol. {entry.volume_number}
              </p>
              {entry.page_count != null && (
                <div className="mt-1.5">
                  <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.min((entry.current_page / entry.page_count) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{entry.current_page} / {entry.page_count}</p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
