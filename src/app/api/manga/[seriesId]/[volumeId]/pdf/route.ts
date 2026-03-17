import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; volumeId: string }> }
) {
  try {
    const { seriesId, volumeId } = await params;
    const mangaDir = process.env.MANGA_DIR ?? '/home/arjay/manga';

    const db = getDb();
    const row = db.prepare(
      `SELECT s.folder_name, v.filename
       FROM volumes v
       JOIN series s ON v.series_id = s.id
       WHERE v.series_id = ? AND v.id = ?`
    ).get(seriesId, volumeId) as { folder_name: string; filename: string } | undefined;

    if (!row) {
      return new Response('Volume not found', { status: 404 });
    }

    const filePath = path.join(mangaDir, row.folder_name, row.filename);

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    const readable = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Error serving PDF:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
