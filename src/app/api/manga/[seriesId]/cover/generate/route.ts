import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { isPdftoppmAvailable, extractFirstPage, ensureCoversDir, getSeriesCoverPath } from '@/lib/pdf-utils';

interface VolumeRow {
  id: number;
  filename: string;
  folder_name: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id, folder_name FROM series WHERE id = ?').get(Number(seriesId)) as { id: number; folder_name: string } | undefined;
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    if (!isPdftoppmAvailable()) {
      return NextResponse.json(
        { error: 'pdftoppm is not installed. Install poppler-utils to enable cover generation.' },
        { status: 500 }
      );
    }

    // Find the first volume (lowest volume_number)
    const volume = db.prepare(`
      SELECT v.id, v.filename, s.folder_name
      FROM volumes v
      JOIN series s ON s.id = v.series_id
      WHERE v.series_id = ?
      ORDER BY v.volume_number ASC
      LIMIT 1
    `).get(Number(seriesId)) as VolumeRow | undefined;

    if (!volume) {
      return NextResponse.json({ error: 'No volumes found for this series' }, { status: 400 });
    }

    const pdfPath = path.join(getMangaDir(), volume.folder_name, volume.filename);
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: 'Volume PDF not found on disk' }, { status: 404 });
    }

    ensureCoversDir(series.folder_name);
    const coverPath = getSeriesCoverPath(series.folder_name);
    extractFirstPage(pdfPath, coverPath);

    db.prepare('UPDATE series SET cover_path = ? WHERE id = ?').run(coverPath, Number(seriesId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate cover:', error);
    return NextResponse.json(
      { error: 'Failed to generate cover' },
      { status: 500 }
    );
  }
}
