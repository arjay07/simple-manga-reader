import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSeries, getVolumesBySeries } from '@/lib/db-queries';
import { apiError, apiSuccess } from '@/lib/api-response';
import fs from 'fs';
import path from 'path';
import { getMangaDir } from '@/lib/settings';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
) {
  try {
    const { seriesId } = await params;

    const series = getSeries(seriesId);
    if (!series) {
      return apiError('Series not found', 404);
    }

    const volumes = getVolumesBySeries(seriesId);
    return apiSuccess({ ...series, volumes });
  } catch (error) {
    console.error('Failed to fetch series:', error);
    return apiError('Failed to fetch series');
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = getSeries(seriesId);
    if (!series) {
      return apiError('Series not found', 404);
    }

    // Delete .covers directory
    const coversDir = path.join(getMangaDir(), series.folder_name, '.covers');
    if (fs.existsSync(coversDir)) {
      fs.rmSync(coversDir, { recursive: true });
    }

    // Delete DB entries
    db.prepare(
      'DELETE FROM reading_progress WHERE volume_id IN (SELECT id FROM volumes WHERE series_id = ?)',
    ).run(series.id);
    db.prepare('DELETE FROM volumes WHERE series_id = ?').run(series.id);
    db.prepare('DELETE FROM series WHERE id = ?').run(series.id);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Failed to delete series:', error);
    return apiError('Failed to delete series');
  }
}
