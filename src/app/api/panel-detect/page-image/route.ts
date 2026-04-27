import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { extractPageAsImage } from '@/lib/panel-detect/extract-page';
import type { Format } from '@/lib/page-source';

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get('seriesId');
  const volumeId = req.nextUrl.searchParams.get('volumeId');
  const page = req.nextUrl.searchParams.get('page');

  if (!seriesId || !volumeId || !page) {
    return NextResponse.json(
      { error: 'Missing required query parameters: seriesId, volumeId, page' },
      { status: 400 }
    );
  }

  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare(
    `SELECT s.folder_name, v.filename, v.page_count, v.format
     FROM volumes v JOIN series s ON v.series_id = s.id
     WHERE v.series_id = ? AND v.id = ?`
  ).get(seriesId, volumeId) as {
    folder_name: string;
    filename: string;
    page_count: number | null;
    format: Format;
  } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  if (row.page_count && pageNum > row.page_count) {
    return NextResponse.json(
      { error: `Page ${pageNum} exceeds total pages (${row.page_count})` },
      { status: 400 }
    );
  }

  const filePath = path.join(getMangaDir(), row.folder_name, row.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Volume file not found' }, { status: 404 });
  }

  try {
    const imageBuffer = await extractPageAsImage(filePath, row.format, pageNum);
    const metadata = await sharp(imageBuffer).metadata();
    const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 80 }).toBuffer();

    return NextResponse.json({
      pageImage: jpegBuffer.toString('base64'),
      imageWidth: metadata.width ?? 0,
      imageHeight: metadata.height ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Panel page-image extraction failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
