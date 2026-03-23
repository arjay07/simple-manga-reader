import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { getMangaDir } from '@/lib/settings';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare(
      'SELECT id, title, folder_name, cover_path, author, description, mangadex_id, created_at FROM series WHERE id = ?'
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id, folder_name FROM series WHERE id = ?').get(seriesId) as { id: number; folder_name: string } | undefined;
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // Delete .covers directory
    const coversDir = path.join(getMangaDir(), series.folder_name, '.covers');
    if (fs.existsSync(coversDir)) {
      fs.rmSync(coversDir, { recursive: true });
    }

    // Delete DB entries
    db.prepare('DELETE FROM reading_progress WHERE volume_id IN (SELECT id FROM volumes WHERE series_id = ?)').run(series.id);
    db.prepare('DELETE FROM volumes WHERE series_id = ?').run(series.id);
    db.prepare('DELETE FROM series WHERE id = ?').run(series.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete series:', error);
    return NextResponse.json({ error: 'Failed to delete series' }, { status: 500 });
  }
}
