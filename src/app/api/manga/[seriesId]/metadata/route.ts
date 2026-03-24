import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params;
  const db = getDb();

  const series = db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId);
  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  }

  const body = (await req.json()) as {
    description?: string;
    author?: string;
    mangadexId?: string;
  };

  db.prepare(
    'UPDATE series SET description = ?, author = ?, mangadex_id = ? WHERE id = ?'
  ).run(body.description ?? null, body.author ?? null, body.mangadexId ?? null, seriesId);

  const updated = db
    .prepare('SELECT id, title, folder_name, cover_path, author, description, mangadex_id FROM series WHERE id = ?')
    .get(seriesId);

  return NextResponse.json(updated);
}
