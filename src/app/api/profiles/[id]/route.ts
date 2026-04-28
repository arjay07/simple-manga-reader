import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError, apiSuccess, parseJsonBody } from '@/lib/api-response';

interface UpdateProfileBody {
  name?: string;
  avatar?: string | null;
  reading_direction?: 'rtl' | 'ltr';
  theme?: 'dark' | 'light';
  reader_settings?: string | object;
  is_child?: boolean | number;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    return apiSuccess(profile);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return apiError('Failed to fetch profile');
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!existing) {
      return apiError('Profile not found', 404);
    }

    const body = await parseJsonBody<UpdateProfileBody>(request);
    if (!body) {
      return apiError('Invalid JSON body', 400);
    }
    const { name, avatar, reading_direction, theme, reader_settings, is_child } = body;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(avatar);
    }
    if (reading_direction !== undefined) {
      fields.push('reading_direction = ?');
      values.push(reading_direction);
    }
    if (theme !== undefined) {
      fields.push('theme = ?');
      values.push(theme);
    }
    if (reader_settings !== undefined) {
      fields.push('reader_settings = ?');
      values.push(
        typeof reader_settings === 'string' ? reader_settings : JSON.stringify(reader_settings),
      );
    }
    if (is_child !== undefined) {
      fields.push('is_child = ?');
      values.push(is_child ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return apiSuccess(profile);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return apiError('A profile with that name already exists', 409);
    }
    console.error('Failed to update profile:', error);
    return apiError('Failed to update profile');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!existing) {
      return apiError('Profile not found', 404);
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM reading_progress WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    });
    deleteTransaction();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return apiError('Failed to delete profile');
  }
}
