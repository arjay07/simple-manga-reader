import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { searchManga } from '@/lib/mangadex';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params;
  const db = getDb();

  const series = db.prepare('SELECT title FROM series WHERE id = ?').get(seriesId) as
    | { title: string }
    | undefined;

  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  }

  try {
    const candidates = await searchManga(series.title);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('MangaDex search failed:', error);
    return NextResponse.json(
      { error: 'Failed to reach MangaDex API' },
      { status: 502 }
    );
  }
}
