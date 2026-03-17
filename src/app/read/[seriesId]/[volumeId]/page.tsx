import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import MangaReader from '@/components/Reader/MangaReader';

interface VolumeRow {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  series_title: string;
  reading_direction: string | null;
  reader_settings: string | null;
}

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ seriesId: string; volumeId: string }>;
  searchParams: Promise<{ profileId?: string }>;
}) {
  const { seriesId, volumeId } = await params;
  const { profileId: profileIdParam } = await searchParams;
  const profileId = profileIdParam ? Number(profileIdParam) : undefined;

  const db = getDb();
  const volume = db
    .prepare(
      `SELECT v.*, s.title as series_title, p.reading_direction, p.reader_settings
       FROM volumes v
       JOIN series s ON s.id = v.series_id
       LEFT JOIN profiles p ON p.id = ?
       WHERE v.series_id = ? AND v.id = ?`
    )
    .get(profileId ?? 1, seriesId, volumeId) as VolumeRow | undefined;

  if (!volume) {
    notFound();
  }

  const displayTitle = volume.series_title
    ? `${volume.series_title} - ${volume.title}`
    : volume.title;

  return (
    <div className="fixed inset-0 bg-black">
      <MangaReader
        seriesId={seriesId}
        volumeId={volumeId}
        initialPage={1}
        profileId={profileId}
        title={displayTitle}
        initialSettings={volume.reader_settings ?? undefined}
        fallbackDirection={volume.reading_direction ?? undefined}
      />
    </div>
  );
}
