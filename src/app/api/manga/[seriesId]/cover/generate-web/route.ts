import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchSeriesCoverUrl } from '@/lib/mangadex-covers';
import { downloadImageFromUrl } from '@/lib/cover-download';
import { saveCover } from '@/lib/covers';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db
      .prepare('SELECT id, folder_name, mangadex_id FROM series WHERE id = ?')
      .get(Number(seriesId)) as
      | { id: number; folder_name: string; mangadex_id: string | null }
      | undefined;

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    if (!series.mangadex_id) {
      return NextResponse.json(
        { error: 'Link this series to MangaDex first via Fetch Metadata.' },
        { status: 400 },
      );
    }

    let coverUrl: string | null;
    try {
      coverUrl = await fetchSeriesCoverUrl(series.mangadex_id);
    } catch {
      return NextResponse.json({ error: 'Failed to reach MangaDex' }, { status: 502 });
    }

    if (!coverUrl) {
      return NextResponse.json({ error: 'No cover available on MangaDex' }, { status: 502 });
    }

    const result = await downloadImageFromUrl(coverUrl);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    saveCover(Number(seriesId), series.folder_name, result.buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate cover:', error);
    return NextResponse.json({ error: 'Failed to generate cover' }, { status: 500 });
  }
}
