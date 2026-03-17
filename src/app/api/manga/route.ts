import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const series = db.prepare(`
      SELECT s.id, s.title, s.folder_name, s.cover_path, s.author, s.description, s.created_at,
             COUNT(v.id) AS volume_count
      FROM series s
      LEFT JOIN volumes v ON v.series_id = s.id
      GROUP BY s.id
      ORDER BY s.title
    `).all();

    return NextResponse.json(series);
  } catch (error) {
    console.error('Failed to fetch series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    );
  }
}
