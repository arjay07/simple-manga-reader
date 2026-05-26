import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { fetchVolumeCoverUrl } from '@/lib/mangadex-covers';
import { downloadImageFromUrl } from '@/lib/cover-download';
import { saveVolumeCover } from '@/lib/covers';
import { getVolumeCoverPath } from '@/lib/pdf-utils';
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

    if (!volume.mangadex_id) {
      return NextResponse.json(
        { error: 'Link this series to MangaDex first via Fetch Metadata.' },
        { status: 400 },
      );
    }

    if (volume.volume_number === null) {
      return NextResponse.json(
        { error: 'Volume number is required to fetch a cover.' },
        { status: 400 },
      );
    }

    // Skip when an override already exists so bulk-fetch loops are idempotent
    // and manual uploads/URLs are preserved across re-runs.
    if (fs.existsSync(getVolumeCoverPath(volume.folder_name, volume.filename))) {
      return NextResponse.json({ success: true, skipped: true, reason: 'override exists' });
    }

    let coverUrl: string | null;
    try {
      coverUrl = await fetchVolumeCoverUrl(volume.mangadex_id, volume.volume_number);
    } catch {
      return NextResponse.json({ error: 'Failed to reach MangaDex' }, { status: 502 });
    }

    if (!coverUrl) {
      return NextResponse.json(
        { error: 'No cover available on MangaDex for this volume' },
        { status: 404 },
      );
    }

    const result = await downloadImageFromUrl(coverUrl);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    saveVolumeCover(volume.folder_name, volume.filename, result.buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate volume cover from web:', error);
    return NextResponse.json({ error: 'Failed to generate volume cover' }, { status: 500 });
  }
}
