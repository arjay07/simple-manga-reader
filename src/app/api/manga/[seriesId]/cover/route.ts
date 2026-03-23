import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getCoverPath, saveCover } from '@/lib/covers';
import { ensureCoversDir } from '@/lib/pdf-utils';

const MAX_URL_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const coverPath = getCoverPath(seriesId);

    if (!coverPath) {
      return NextResponse.json({ error: 'No cover found' }, { status: 404 });
    }

    const imageBuffer = fs.readFileSync(coverPath);
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to serve cover:', error);
    return NextResponse.json({ error: 'Failed to serve cover' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id, folder_name FROM series WHERE id = ?').get(seriesId) as { id: number; folder_name: string } | undefined;
    if (!series) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }

    ensureCoversDir(series.folder_name);

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

      saveCover(seriesId, series.folder_name, Buffer.from(arrayBuffer));
      return NextResponse.json({ success: true });
    }

    // Handle multipart form data
    const formData = await request.formData();
    const file = formData.get('cover') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No cover image provided' },
        { status: 400 }
      );
    }

    saveCover(seriesId, series.folder_name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upload cover:', error);
    return NextResponse.json(
      { error: 'Failed to upload cover' },
      { status: 500 }
    );
  }
}
