import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import MangaReader from '@/components/Reader/MangaReader';
import { unitLabel } from '@/lib/unit-label';
import type { SeriesKind, Volume } from '@/types';

type VolumeRow = Volume & {
  series_title: string;
  series_kind: SeriesKind;
  reading_direction: string | null;
  reader_settings: string | null;
};

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ seriesId: string; volumeId: string }>;
}) {
  const { seriesId, volumeId } = await params;
  const cookieStore = await cookies();
  const profileIdCookie = cookieStore.get('profileId')?.value;
  const profileId = profileIdCookie ? Number(profileIdCookie) : undefined;

  const db = getDb();
  const volume = db
    .prepare(
      `SELECT v.*, s.title as series_title, s.kind as series_kind, p.reading_direction, p.reader_settings
       FROM volumes v
       JOIN series s ON s.id = v.series_id
       LEFT JOIN profiles p ON p.id = ?
       WHERE v.series_id = ? AND v.id = ?`,
    )
    .get(profileId ?? 1, seriesId, volumeId) as VolumeRow | undefined;

  if (!volume) {
    notFound();
  }

  // Query adjacent volumes for next/prev navigation
  const nextVolume =
    volume.volume_number != null
      ? (db
          .prepare(
            `SELECT id, title, volume_number FROM volumes
         WHERE series_id = ? AND volume_number > ?
         ORDER BY volume_number LIMIT 1`,
          )
          .get(seriesId, volume.volume_number) as
          | { id: number; title: string; volume_number: number }
          | undefined)
      : undefined;

  const prevVolume =
    volume.volume_number != null
      ? (db
          .prepare(
            `SELECT id, title, volume_number FROM volumes
         WHERE series_id = ? AND volume_number < ?
         ORDER BY volume_number DESC LIMIT 1`,
          )
          .get(seriesId, volume.volume_number) as
          | { id: number; title: string; volume_number: number }
          | undefined)
      : undefined;

  // For chapter series the stored title is a raw filename (e.g. "Chapter-001"),
  // so show a human label ("Ch. 2") in the next/prev overlay instead. Volume
  // series keep their existing title wording unchanged.
  const adjacentTitle = (
    v: { title: string; volume_number: number } | undefined,
  ): string | undefined => {
    if (!v) return undefined;
    if (volume.series_kind === 'chapter' && v.volume_number != null) {
      return unitLabel('chapter', v.volume_number);
    }
    return v.title;
  };

  let initialPage = 1;
  if (profileId) {
    const progress = db
      .prepare('SELECT current_page FROM reading_progress WHERE profile_id = ? AND volume_id = ?')
      .get(profileId, volumeId) as { current_page: number } | undefined;
    if (progress) {
      initialPage = progress.current_page;
    }
  }

  // Chapter titles are raw filenames; show "Ch. N" in the reader chrome instead.
  // Volume series keep their stored title verbatim (unchanged behavior).
  const unitTitle =
    volume.series_kind === 'chapter' && volume.volume_number != null
      ? unitLabel('chapter', volume.volume_number)
      : volume.title;
  const displayTitle = volume.series_title
    ? `${volume.series_title} - ${unitTitle}`
    : unitTitle;

  return (
    <div className="fixed inset-0 bg-black">
      <MangaReader
        seriesId={seriesId}
        volumeId={volumeId}
        format={volume.format}
        kind={volume.series_kind}
        initialPage={initialPage}
        profileId={profileId}
        title={displayTitle}
        initialSettings={volume.reader_settings ?? undefined}
        fallbackDirection={volume.reading_direction ?? undefined}
        nextVolumeId={nextVolume ? String(nextVolume.id) : undefined}
        nextVolumeTitle={adjacentTitle(nextVolume)}
        prevVolumeId={prevVolume ? String(prevVolume.id) : undefined}
        prevVolumeTitle={adjacentTitle(prevVolume)}
      />
    </div>
  );
}
