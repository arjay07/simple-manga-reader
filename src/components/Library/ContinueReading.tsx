'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProfile } from '@/components/ProfileProvider';

interface ProgressEntry {
  volume_id: number;
  current_page: number;
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
            href={`/read/${entry.series_id}/${entry.volume_id}?profileId=${profile.id}`}
            className="flex-shrink-0 w-48 rounded-lg bg-surface p-4 transition-colors hover:bg-surface-elevated"
          >
            <p className="truncate text-sm font-medium text-foreground">
              {entry.series_title}
            </p>
            <p className="mt-1 text-xs text-muted">
              Volume {entry.volume_number}
            </p>
            <span className="mt-3 inline-block text-xs font-medium text-accent">
              Continue
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
