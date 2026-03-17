import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  try {
    const db = getDb();
    const progress = db.prepare(`
      SELECT rp.*, v.title as volume_title, v.volume_number, v.series_id, s.title as series_title
      FROM reading_progress rp
      JOIN volumes v ON rp.volume_id = v.id
      JOIN series s ON v.series_id = s.id
      WHERE rp.profile_id = ?
      ORDER BY rp.updated_at DESC
    `).all(profileId);

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Failed to fetch reading progress:', error);
    return NextResponse.json({ error: 'Failed to fetch reading progress' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, volumeId, currentPage } = body;

    if (!profileId || !volumeId || currentPage === undefined) {
      return NextResponse.json(
        { error: 'profileId, volumeId, and currentPage are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO reading_progress (profile_id, volume_id, current_page, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id, volume_id) DO UPDATE SET
        current_page = excluded.current_page,
        updated_at = CURRENT_TIMESTAMP
    `).run(profileId, volumeId, currentPage);

    const progress = db.prepare(
      'SELECT * FROM reading_progress WHERE profile_id = ? AND volume_id = ?'
    ).get(profileId, volumeId);

    return NextResponse.json(progress, { status: 200 });
  } catch (error) {
    console.error('Failed to save reading progress:', error);
    return NextResponse.json({ error: 'Failed to save reading progress' }, { status: 500 });
  }
}
