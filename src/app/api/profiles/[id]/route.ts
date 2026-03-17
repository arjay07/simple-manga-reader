import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, avatar, reading_direction, theme } = body;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (reading_direction !== undefined) { fields.push('reading_direction = ?'); values.push(reading_direction); }
    if (theme !== undefined) { fields.push('theme = ?'); values.push(theme); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM reading_progress WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    });
    deleteTransaction();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
