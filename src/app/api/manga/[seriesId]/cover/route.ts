import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getCoverPath, saveCover } from '@/lib/covers';
import { ensureCoversDir } from '@/lib/pdf-utils';
import { parseJsonBody } from '@/lib/api-response';
import { downloadImageFromUrl } from '@/lib/cover-download';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
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
  { params }: { params: Promise<{ seriesId: string }> },
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id, folder_name FROM series WHERE id = ?').get(seriesId) as
      | { id: number; folder_name: string }
      | undefined;
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    ensureCoversDir(series.folder_name);

    const contentType = request.headers.get('content-type') ?? '';

    // Handle JSON body with URL
    if (contentType.includes('application/json')) {
      const body = await parseJsonBody<{ url?: string }>(request);
      if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      const { url } = body;

      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      const result = await downloadImageFromUrl(url);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      saveCover(seriesId, series.folder_name, result.buffer);
      return NextResponse.json({ success: true });
    }

    // Handle multipart form data
    const formData = await request.formData();
    const file = formData.get('cover') as File;

    if (!file) {
      return NextResponse.json({ error: 'No cover image provided' }, { status: 400 });
    }

    saveCover(seriesId, series.folder_name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upload cover:', error);
    return NextResponse.json({ error: 'Failed to upload cover' }, { status: 500 });
  }
}
