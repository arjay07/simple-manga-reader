import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { extractPageAsImage } from '@/lib/panel-detect/extract-page';
import { detectPanelsMl } from '@/lib/panel-detect/ml';
import { assignReadingOrder } from '@/lib/panel-detect/reading-order';
import type { PanelDetectResponse } from '@/lib/panel-detect/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seriesId, volumeId, page, confidenceThreshold } = body;

    // Look up the PDF file path
    const db = getDb();
    const row = db.prepare(
      `SELECT s.folder_name, v.filename, v.page_count
       FROM volumes v
       JOIN series s ON v.series_id = s.id
       WHERE v.series_id = ? AND v.id = ?`
    ).get(seriesId, volumeId) as {
      folder_name: string;
      filename: string;
      page_count: number | null;
    } | undefined;

    if (!row) {
      return NextResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    const pdfPath = path.join(getMangaDir(), row.folder_name, row.filename);
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: 'PDF file not found on disk' },
        { status: 404 }
      );
    }

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: 'Invalid page number' },
        { status: 400 }
      );
    }

    if (row.page_count && pageNum > row.page_count) {
      return NextResponse.json(
        { error: `Page ${pageNum} exceeds total pages (${row.page_count})` },
        { status: 400 }
      );
    }

    // Extract page image
    const imageBuffer = await extractPageAsImage(pdfPath, pageNum);

    // Run ML detection
    const start = Date.now();
    const threshold = typeof confidenceThreshold === 'number' ? confidenceThreshold : 0.25;
    const detection = await detectPanelsMl(imageBuffer, threshold);
    const { panels, readingTree } = assignReadingOrder(detection.panels);
    const processingTimeMs = Date.now() - start;

    const metadata = await sharp(imageBuffer).metadata();

    // Encode page image as base64 JPEG for the client
    const jpegBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 80 })
      .toBuffer();
    const pageImage = jpegBuffer.toString('base64');

    const response = {
      results: {
        ml: {
          panels,
          readingTree,
          pageType: detection.pageType,
          processingTimeMs,
          method: 'ml',
          debug: detection.debug,
        },
      },
      pageImage,
      imageWidth: metadata.width ?? 0,
      imageHeight: metadata.height ?? 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Panel detection error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Panel detection failed: ${message}` },
      { status: 500 }
    );
  }
}
