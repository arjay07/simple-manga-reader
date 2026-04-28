import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError, apiSuccess, parseJsonBody } from '@/lib/api-response';

export async function GET() {
  try {
    const db = getDb();
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all();
    return apiSuccess(profiles);
  } catch (error) {
    console.error('Failed to fetch profiles:', error);
    return apiError('Failed to fetch profiles');
  }
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody<{ name?: string; avatar?: string | null }>(request);
  if (!body) {
    return apiError('Invalid JSON body', 400);
  }
  const { name, avatar } = body;

  if (!name) {
    return apiError('Name is required', 400);
  }

  try {
    const db = getDb();
    const result = db
      .prepare('INSERT INTO profiles (name, avatar) VALUES (?, ?)')
      .run(name, avatar ?? null);

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);

    return apiSuccess(profile, 201);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return apiError('A profile with that name already exists', 409);
    }
    console.error('Failed to create profile:', error);
    return apiError('Failed to create profile');
  }
}
