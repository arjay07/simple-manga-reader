import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSeries } from '@/lib/db-queries';
import { apiError, apiSuccess, parseJsonBody } from '@/lib/api-response';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> },
) {
  const { seriesId } = await params;

  if (!getSeries(seriesId)) {
    return apiError('Series not found', 404);
  }

  const body = await parseJsonBody<{
    description?: string;
    author?: string;
    mangadexId?: string;
  }>(req);
  if (!body) {
    return apiError('Invalid JSON body', 400);
  }

  const db = getDb();
  db.prepare('UPDATE series SET description = ?, author = ?, mangadex_id = ? WHERE id = ?').run(
    body.description ?? null,
    body.author ?? null,
    body.mangadexId ?? null,
    seriesId,
  );

  return apiSuccess(getSeries(seriesId));
}
