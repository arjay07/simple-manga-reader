import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError, apiSuccess, parseJsonBody } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');

  if (!profileId) {
    return apiError('profileId is required', 400);
  }

  try {
    const db = getDb();
    const volumeId = request.nextUrl.searchParams.get('volumeId');

    if (volumeId) {
      const progress = db
        .prepare(
          `
        SELECT rp.*, v.title as volume_title, v.volume_number, v.page_count, v.series_id, s.title as series_title, s.kind as series_kind
        FROM reading_progress rp
        JOIN volumes v ON rp.volume_id = v.id
        JOIN series s ON v.series_id = s.id
        WHERE rp.profile_id = ? AND rp.volume_id = ?
      `,
        )
        .get(profileId, volumeId);

      return apiSuccess(progress ?? null);
    }

    const progress = db
      .prepare(
        `
      SELECT rp.*, v.title as volume_title, v.volume_number, v.page_count, v.series_id, s.title as series_title, s.kind as series_kind
      FROM reading_progress rp
      JOIN volumes v ON rp.volume_id = v.id
      JOIN series s ON v.series_id = s.id
      WHERE rp.profile_id = ?
      ORDER BY rp.updated_at DESC
    `,
      )
      .all(profileId);

    return apiSuccess(progress);
  } catch (error) {
    console.error('Failed to fetch reading progress:', error);
    return apiError('Failed to fetch reading progress');
  }
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody<{
    profileId?: number;
    volumeId?: number;
    currentPage?: number;
  }>(request);
  if (!body) {
    return apiError('Invalid JSON body', 400);
  }
  const { profileId, volumeId, currentPage } = body;

  if (!profileId || !volumeId || currentPage === undefined) {
    return apiError('profileId, volumeId, and currentPage are required', 400);
  }

  try {
    const db = getDb();
    db.prepare(
      `
      INSERT INTO reading_progress (profile_id, volume_id, current_page, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id, volume_id) DO UPDATE SET
        current_page = excluded.current_page,
        updated_at = CURRENT_TIMESTAMP
    `,
    ).run(profileId, volumeId, currentPage);

    const progress = db
      .prepare('SELECT * FROM reading_progress WHERE profile_id = ? AND volume_id = ?')
      .get(profileId, volumeId);

    return apiSuccess(progress);
  } catch (error) {
    console.error('Failed to save reading progress:', error);
    return apiError('Failed to save reading progress');
  }
}
