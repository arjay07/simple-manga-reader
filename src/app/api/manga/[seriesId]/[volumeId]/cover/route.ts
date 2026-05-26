import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { saveVolumeCover } from '@/lib/covers';
import { ensureCoversDir } from '@/lib/pdf-utils';
import { parseJsonBody } from '@/lib/api-response';
import { downloadImageFromUrl } from '@/lib/cover-download';
import type { Format } from '@/lib/page-source';

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
  request: NextRequest,
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

    ensureCoversDir(volume.folder_name);

    const contentType = request.headers.get('content-type') ?? '';

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

      saveVolumeCover(volume.folder_name, volume.filename, result.buffer);
      return NextResponse.json({ success: true });
    }

    const formData = await request.formData();
    const file = formData.get('cover') as File;

    if (!file) {
      return NextResponse.json({ error: 'No cover image provided' }, { status: 400 });
    }

    saveVolumeCover(volume.folder_name, volume.filename, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upload volume cover:', error);
    return NextResponse.json({ error: 'Failed to upload volume cover' }, { status: 500 });
  }
}
