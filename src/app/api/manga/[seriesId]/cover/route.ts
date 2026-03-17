import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

const MAX_URL_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB

function saveCover(seriesId: string, buffer: Buffer) {
  const coversDir = path.resolve(process.cwd(), 'public/covers');
  fs.mkdirSync(coversDir, { recursive: true });

  const coverPath = path.join(coversDir, `${seriesId}.jpg`);
  fs.writeFileSync(coverPath, buffer);

  const dbCoverPath = `/covers/${seriesId}.jpg`;
  const db = getDb();
  db.prepare('UPDATE series SET cover_path = ? WHERE id = ?').run(dbCoverPath, seriesId);

  return dbCoverPath;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId);
    if (!series) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }

    const contentType = request.headers.get('content-type') ?? '';

    // Handle JSON body with URL
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { url } = body;

      if (!url || typeof url !== 'string') {
        return NextResponse.json(
          { error: 'URL is required' },
          { status: 400 }
        );
      }

      // Validate scheme
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Only http and https URLs are allowed' },
          { status: 400 }
        );
      }

      const response = await fetch(url);
      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to download image: ${response.status}` },
          { status: 400 }
        );
      }

      const remoteContentType = response.headers.get('content-type') ?? '';
      if (!remoteContentType.startsWith('image/')) {
        return NextResponse.json(
          { error: 'URL does not point to an image' },
          { status: 400 }
        );
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_URL_DOWNLOAD_SIZE) {
        return NextResponse.json(
          { error: 'Image exceeds 10MB size limit' },
          { status: 400 }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_URL_DOWNLOAD_SIZE) {
        return NextResponse.json(
          { error: 'Image exceeds 10MB size limit' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(arrayBuffer);
      const dbCoverPath = saveCover(seriesId, buffer);

      return NextResponse.json({
        success: true,
        cover_path: dbCoverPath,
      });
    }

    // Handle multipart form data (existing behavior)
    const formData = await request.formData();
    const file = formData.get('cover') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No cover image provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dbCoverPath = saveCover(seriesId, buffer);

    return NextResponse.json({
      success: true,
      cover_path: dbCoverPath,
    });
  } catch (error) {
    console.error('Failed to upload cover:', error);
    return NextResponse.json(
      { error: 'Failed to upload cover' },
      { status: 500 }
    );
  }
}
