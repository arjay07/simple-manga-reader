import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPanelDataForPages } from '@/lib/panel-data';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  const { volumeId } = await params;
  const vid = Number(volumeId);

  const pagesParam = req.nextUrl.searchParams.get('pages');
  if (!pagesParam) {
    return NextResponse.json({ error: 'Missing required query parameter: pages' }, { status: 400 });
  }

  const db = getDb();
  const volume = db.prepare('SELECT id FROM volumes WHERE id = ?').get(vid);
  if (!volume) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  const pageNumbers = pagesParam
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);

  const pages = getPanelDataForPages(vid, pageNumbers);

  return NextResponse.json({ pages });
}
