import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import MangaReader from '@/components/Reader/MangaReader';

interface VolumeRow {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  reading_direction: string | null;
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
      `SELECT v.*, p.reading_direction
       FROM volumes v
       LEFT JOIN profiles p ON p.id = 1
       WHERE v.series_id = ? AND v.id = ?`
    )
    .get(seriesId, volumeId) as VolumeRow | undefined;

  if (!volume) {
    notFound();
  }

  const direction = (volume.reading_direction === 'ltr' ? 'ltr' : 'rtl') as
    | 'rtl'
    | 'ltr';

  return (
    <div className="fixed inset-0 bg-black">
      <MangaReader
        seriesId={seriesId}
        volumeId={volumeId}
        initialPage={1}
        readingDirection={direction}
        profileId={profileId}
      />
    </div>
  );
}
