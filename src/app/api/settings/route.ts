import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, getMangaDir } from '@/lib/settings';
import fs from 'fs';

export async function GET() {
  return NextResponse.json({
    manga_dir: getMangaDir(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.manga_dir !== undefined) {
      const dir = String(body.manga_dir).trim();
      if (!dir) {
        return NextResponse.json({ error: 'manga_dir cannot be empty' }, { status: 400 });
      }
      if (!fs.existsSync(dir)) {
        return NextResponse.json({ error: 'Directory does not exist' }, { status: 400 });
      }
      setSetting('manga_dir', dir);
    }

    return NextResponse.json({
      manga_dir: getMangaDir(),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
