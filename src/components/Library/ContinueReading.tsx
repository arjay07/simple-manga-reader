'use client';

import Link from 'next/link';
import { useProfile } from '@/components/ProfileProvider';
import { useFetch } from '@/hooks/useFetch';
import { VolumeThumbnail } from './VolumeThumbnail';
import { apiUrl } from '@/lib/basePath';
import { unitLabel } from '@/lib/unit-label';
import type { ProgressEntryWithSeries as ProgressEntry } from '@/types';

export function ContinueReading() {
  const { profile } = useProfile();
  const url = profile ? apiUrl(`/api/progress?profileId=${profile.id}`) : null;
  const { data } = useFetch<ProgressEntry[]>(url);
  const entries = (data ?? []).slice(0, 6);

  if (!profile || entries.length === 0) return null;

  const hero = entries[0];
  const rest = entries.slice(1);
  const heroProgress =
    hero.page_count != null
      ? Math.min(Math.round((hero.current_page / hero.page_count) * 100), 100)
      : null;

  return (
    <section className="mb-8">
      {/* Hero resume card */}
      <Link
        href={`/read/${hero.series_id}/${hero.volume_id}`}
        className="group mb-6 flex items-center gap-4 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-elevated"
      >
        <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-border">
          <img
            src={apiUrl(`/api/manga/${hero.series_id}/${hero.volume_id}/thumbnail`)}
            alt={hero.series_title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{hero.series_title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {unitLabel(hero.series_kind, hero.volume_number)}
            {heroProgress != null && (
              <span className="ml-2 text-muted">
                {hero.current_page} / {hero.page_count} ({heroProgress}%)
              </span>
            )}
          </p>
          {heroProgress != null && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${heroProgress}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex-shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-accent/80">
          Resume
        </div>
      </Link>

      {/* Remaining entries as horizontal scroll */}
      {rest.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-medium text-muted uppercase tracking-wide">
            Continue Reading
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {rest.map((entry) => (
              <Link
                key={entry.volume_id}
                href={`/read/${entry.series_id}/${entry.volume_id}`}
                className="flex-shrink-0 w-36 rounded-lg bg-surface overflow-hidden transition-colors hover:bg-surface-elevated"
              >
                <VolumeThumbnail
                  seriesId={entry.series_id}
                  volumeId={entry.volume_id}
                  volumeNumber={entry.volume_number}
                  kind={entry.series_kind}
                />
                <div className="px-3 pb-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.series_title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {unitLabel(entry.series_kind, entry.volume_number)}
                  </p>
                  {entry.page_count != null && (
                    <div className="mt-1.5">
                      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{
                            width: `${Math.min((entry.current_page / entry.page_count) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {entry.current_page} / {entry.page_count}
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
