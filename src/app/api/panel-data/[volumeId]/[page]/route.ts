import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { getPanelDataForPage } from '@/lib/panel-data';
import { extractPageAsImage } from '@/lib/panel-detect/extract-page';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ volumeId: string; page: string }> }
) {
  const { volumeId, page } = await params;
  const vid = Number(volumeId);
  const pageNum = Number(page);

  const panelData = getPanelDataForPage(vid, pageNum);
  if (!panelData) {
    return NextResponse.json({ error: 'No panel data for this page' }, { status: 404 });
  }

  const db = getDb();
  const row = db.prepare(
    `SELECT s.folder_name, v.filename
     FROM volumes v JOIN series s ON v.series_id = s.id
     WHERE v.id = ?`
  ).get(vid) as { folder_name: string; filename: string } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  const pdfPath = path.join(getMangaDir(), row.folder_name, row.filename);
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
  }

  const imageBuffer = await extractPageAsImage(pdfPath, pageNum);
  const metadata = await sharp(imageBuffer).metadata();
  const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 80 }).toBuffer();
  const pageImage = jpegBuffer.toString('base64');

  return NextResponse.json({
    ...panelData,
    pageImage,
    imageWidth: metadata.width ?? 0,
    imageHeight: metadata.height ?? 0,
  });
}
