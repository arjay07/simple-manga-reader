import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { extractPageAsImage } from '@/lib/panel-detect/extract-page';
import { getDetector, type DetectorName } from '@/lib/panel-detect/detector';
import { assignReadingOrder } from '@/lib/panel-detect/reading-order';
import { classifyPageType } from '@/lib/panel-detect/classify';
import type { Format } from '@/lib/page-source';

const VALID_STRATEGIES: DetectorName[] = ['ml', 'contour'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seriesId, volumeId, page, confidenceThreshold, strategy } = body;

    const detectorName: DetectorName = strategy ?? 'ml';
    if (!VALID_STRATEGIES.includes(detectorName)) {
      return NextResponse.json(
        { error: `Invalid strategy: ${strategy}. Expected one of ${VALID_STRATEGIES.join(', ')}` },
        { status: 400 },
      );
    }

    // Look up the volume file path and format
    const db = getDb();
    const row = db
      .prepare(
        `SELECT s.folder_name, v.filename, v.page_count, v.format
       FROM volumes v
       JOIN series s ON v.series_id = s.id
       WHERE v.series_id = ? AND v.id = ?`,
      )
      .get(seriesId, volumeId) as
      | {
          folder_name: string;
          filename: string;
          page_count: number | null;
          format: Format;
        }
      | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    const filePath = path.join(getMangaDir(), row.folder_name, row.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Volume file not found on disk' }, { status: 404 });
    }

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
    }

    if (row.page_count && pageNum > row.page_count) {
      return NextResponse.json(
        { error: `Page ${pageNum} exceeds total pages (${row.page_count})` },
        { status: 400 },
      );
    }

    // Extract page image via the format-agnostic page source
    const imageBuffer = await extractPageAsImage(filePath, row.format, pageNum);

    // Run detection via the selected strategy
    const start = Date.now();
    const threshold = typeof confidenceThreshold === 'number' ? confidenceThreshold : 0.25;
    const rawPanels = await getDetector(detectorName).detect(imageBuffer, { confidence: threshold });
    const pageType = classifyPageType(rawPanels);
    const { panels, readingTree } = assignReadingOrder(rawPanels);
    const processingTimeMs = Date.now() - start;

    const metadata = await sharp(imageBuffer).metadata();

    // Encode page image as base64 JPEG for the client
    const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 80 }).toBuffer();
    const pageImage = jpegBuffer.toString('base64');

    const response = {
      results: {
        [detectorName]: {
          panels,
          readingTree,
          pageType,
          processingTimeMs,
          method: detectorName,
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
    return NextResponse.json({ error: `Panel detection failed: ${message}` }, { status: 500 });
  }
}
