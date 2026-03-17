import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { isPdftoppmAvailable, extractFirstPage, ensureCoversDir, getVolumeThumbnailPath } from '@/lib/pdf-utils';

const mangaDir = process.env.MANGA_DIR ?? '/home/arjay/manga';

interface VolumeRow {
  id: number;
  series_id: number;
  filename: string;
  folder_name: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; volumeId: string }> }
) {
  try {
    const { seriesId, volumeId } = await params;
    const db = getDb();

    const volume = db.prepare(`
      SELECT v.id, v.series_id, v.filename, s.folder_name
      FROM volumes v
      JOIN series s ON s.id = v.series_id
      WHERE v.id = ? AND v.series_id = ?
    `).get(Number(volumeId), Number(seriesId)) as VolumeRow | undefined;

    if (!volume) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    // Check for cached thumbnail
    const cachedPath = getVolumeThumbnailPath(volume.folder_name, volumeId);

    if (fs.existsSync(cachedPath)) {
      const imageBuffer = fs.readFileSync(cachedPath);
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Generate thumbnail
    if (!isPdftoppmAvailable()) {
      return NextResponse.json(
        { error: 'pdftoppm is not installed. Install poppler-utils to enable thumbnail generation.' },
        { status: 500 }
      );
    }

    const pdfPath = path.join(mangaDir, volume.folder_name, volume.filename);
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: 'Volume PDF not found on disk' }, { status: 404 });
    }

    ensureCoversDir(volume.folder_name);
    extractFirstPage(pdfPath, cachedPath);

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
