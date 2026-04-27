import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { ensureCoversDir, getSeriesCoverPath } from '@/lib/pdf-utils';
import { openPageSource, type Format } from '@/lib/page-source';

interface VolumeRow {
  id: number;
  filename: string;
  folder_name: string;
  format: Format;
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

    // Find the first volume (lowest volume_number)
    const volume = db.prepare(`
      SELECT v.id, v.filename, v.format, s.folder_name
      FROM volumes v
      JOIN series s ON s.id = v.series_id
      WHERE v.series_id = ?
      ORDER BY v.volume_number ASC
      LIMIT 1
    `).get(Number(seriesId)) as VolumeRow | undefined;

    if (!volume) {
      return NextResponse.json({ error: 'No volumes found for this series' }, { status: 400 });
    }

    const filePath = path.join(getMangaDir(), volume.folder_name, volume.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Volume file not found on disk' }, { status: 404 });
    }

    ensureCoversDir(series.folder_name);
    const coverPath = getSeriesCoverPath(series.folder_name);

    const source = openPageSource(filePath, volume.format);
    try {
      const firstPage = await source.extractPage(1, { dpi: 150 });
      await sharp(firstPage).jpeg({ quality: 90 }).toFile(coverPath);
    } finally {
      await source.close();
    }

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
