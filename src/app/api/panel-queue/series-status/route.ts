import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get('seriesId');
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
  }

  const db = getDb();
  const rows = db.prepare(
    `SELECT v.id as volume_id, v.page_count,
            COUNT(pd.id) as processed_pages
     FROM volumes v
     LEFT JOIN panel_data pd ON pd.volume_id = v.id
     WHERE v.series_id = ?
     GROUP BY v.id`
  ).all(Number(seriesId)) as Array<{
    volume_id: number;
    page_count: number | null;
    processed_pages: number;
  }>;

  const status: Record<number, { totalPages: number; processedPages: number; isComplete: boolean }> = {};
  for (const row of rows) {
    const totalPages = row.page_count ?? 0;
    status[row.volume_id] = {
      totalPages,
      processedPages: row.processed_pages,
      isComplete: totalPages > 0 && row.processed_pages >= totalPages,
    };
  }

  return NextResponse.json(status);
}
