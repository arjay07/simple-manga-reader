import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';

function streamToReadable(fileStream: fs.ReadStream): ReadableStream {
  return new ReadableStream({
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
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; volumeId: string }> }
) {
  try {
    const { seriesId, volumeId } = await params;
    const mangaDir = getMangaDir();

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

    const { size: fileSize } = fs.statSync(filePath);
    const commonHeaders = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
      if (!match) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      return new Response(streamToReadable(fileStream), {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': String(chunkSize),
        },
      });
    }

    const fileStream = fs.createReadStream(filePath);
    return new Response(streamToReadable(fileStream), {
      headers: {
        ...commonHeaders,
        'Content-Length': String(fileSize),
      },
    });
  } catch (err) {
    console.error('Error serving PDF:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
