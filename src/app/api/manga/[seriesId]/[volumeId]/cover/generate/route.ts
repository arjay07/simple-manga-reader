import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { ensureCoversDir, getVolumeThumbnailPath } from '@/lib/pdf-utils';
import { openPageSource, type Format } from '@/lib/page-source';

interface VolumeRow {
  id: number;
  series_id: number;
  filename: string;
  format: Format;
  volume_number: number | null;
  folder_name: string;
  mangadex_id: string | null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; volumeId: string }> },
) {
  try {
    const { seriesId, volumeId } = await params;
    const db = getDb();

    const volume = db
      .prepare(
        `
      SELECT v.id, v.series_id, v.filename, v.format, v.volume_number, s.folder_name, s.mangadex_id
      FROM volumes v
      JOIN series s ON s.id = v.series_id
      WHERE v.id = ? AND v.series_id = ?
    `,
      )
      .get(Number(volumeId), Number(seriesId)) as VolumeRow | undefined;

    if (!volume) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    const filePath = path.join(getMangaDir(), volume.folder_name, volume.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Volume file not found on disk' }, { status: 404 });
    }

    ensureCoversDir(volume.folder_name);

    const source = openPageSource(filePath, volume.format);
    try {
      const firstPage = await source.extractPage(1, { dpi: 150 });
      await sharp(firstPage)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(getVolumeThumbnailPath(volume.folder_name, volume.filename));
    } finally {
      await source.close();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to regenerate volume thumbnail:', error);
    return NextResponse.json({ error: 'Failed to regenerate volume thumbnail' }, { status: 500 });
  }
}
