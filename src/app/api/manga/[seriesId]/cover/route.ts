import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const db = getDb();

    const series = db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId);
    if (!series) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('cover') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No cover image provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const coversDir = path.resolve(process.cwd(), 'public/covers');
    fs.mkdirSync(coversDir, { recursive: true });

    const coverPath = path.join(coversDir, `${seriesId}.jpg`);
    fs.writeFileSync(coverPath, buffer);

    const dbCoverPath = `/covers/${seriesId}.jpg`;
    db.prepare('UPDATE series SET cover_path = ? WHERE id = ?').run(dbCoverPath, seriesId);

    return NextResponse.json({
      success: true,
      cover_path: dbCoverPath,
    });
  } catch (error) {
    console.error('Failed to upload cover:', error);
    return NextResponse.json(
      { error: 'Failed to upload cover' },
      { status: 500 }
    );
  }
}
