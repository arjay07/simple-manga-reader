import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
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

  let initialPage = 1;
  if (profileId) {
    const progress = db
      .prepare('SELECT current_page FROM reading_progress WHERE profile_id = ? AND volume_id = ?')
      .get(profileId, volumeId) as { current_page: number } | undefined;
    if (progress) {
      initialPage = progress.current_page;
    }
  }

  const displayTitle = volume.series_title
    ? `${volume.series_title} - ${volume.title}`
    : volume.title;

  return (
    <div className="fixed inset-0 bg-black">
      <MangaReader
        seriesId={seriesId}
        volumeId={volumeId}
        initialPage={initialPage}
        profileId={profileId}
        title={displayTitle}
        initialSettings={volume.reader_settings ?? undefined}
        fallbackDirection={volume.reading_direction ?? undefined}
      />
    </div>
  );
}
