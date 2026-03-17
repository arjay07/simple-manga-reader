import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare(
      'SELECT id, title, folder_name, cover_path, author, description, created_at FROM series WHERE id = ?'
    ).get(seriesId) as Record<string, unknown> | undefined;

    if (!series) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }

    const volumes = db.prepare(
      'SELECT id, title, filename, volume_number, page_count, created_at FROM volumes WHERE series_id = ? ORDER BY volume_number'
    ).all(seriesId);

    return NextResponse.json({ ...series, volumes });
  } catch (error) {
    console.error('Failed to fetch series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    );
  }
}
