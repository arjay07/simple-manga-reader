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
  folder_name: string;
  format: Format;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; volumeId: string }> }
) {
  try {
    const { seriesId, volumeId } = await params;
    const db = getDb();

    const volume = db.prepare(`
      SELECT v.id, v.series_id, v.filename, v.format, s.folder_name
      FROM volumes v
      JOIN series s ON s.id = v.series_id
      WHERE v.id = ? AND v.series_id = ?
    `).get(Number(volumeId), Number(seriesId)) as VolumeRow | undefined;

    if (!volume) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    const cachedPath = getVolumeThumbnailPath(volume.folder_name, volume.filename);

    if (fs.existsSync(cachedPath)) {
      const imageBuffer = fs.readFileSync(cachedPath);
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const filePath = path.join(getMangaDir(), volume.folder_name, volume.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Volume file not found on disk' }, { status: 404 });
    }

    ensureCoversDir(volume.folder_name);

    // Format-agnostic: PageSource handles PDF (pdftoppm → mupdf fallback) and CBZ.
    // sharp converts the raw bytes to a cached JPEG suitable for the library grid.
    // Resize to a max 600px width — library tiles render around this size, so
    // anything larger just inflates payload and storage without visible gain.
    const source = openPageSource(filePath, volume.format);
    try {
      const firstPage = await source.extractPage(1, { dpi: 150 });
      await sharp(firstPage)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(cachedPath);
    } finally {
      await source.close();
    }

    const imageBuffer = fs.readFileSync(cachedPath);
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return NextResponse.json(
      { error: 'Failed to generate thumbnail' },
      { status: 500 }
    );
  }
}
