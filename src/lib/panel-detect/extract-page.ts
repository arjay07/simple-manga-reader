import path from 'path';
import { getDb } from '../db';
import { getMangaDir } from '../settings';
import { openPageSource, type Format } from '../page-source';

interface VolumeFileInfo {
  filePath: string;
  format: Format;
}

/**
 * Resolve a volume's on-disk path and format from its DB row.
 * Throws if the volume is missing or the file does not exist on disk.
 */
export function resolveVolumeFile(volumeId: number): VolumeFileInfo {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.folder_name, v.filename, v.format
     FROM volumes v JOIN series s ON v.series_id = s.id
     WHERE v.id = ?`,
    )
    .get(volumeId) as { folder_name: string; filename: string; format: Format } | undefined;

  if (!row) {
    throw new Error(`Volume ${volumeId} not found`);
  }

  const filePath = path.join(getMangaDir(), row.folder_name, row.filename);
  return { filePath, format: row.format };
}

/**
 * Extract a single page as image bytes (PNG for PDFs, native bytes for CBZ).
 * Routes through the format-agnostic PageSource abstraction.
 *
 * @param filePath - absolute path to the volume file (PDF or CBZ)
 * @param format - the volume's format
 * @param pageNumber - 1-based page number
 * @param dpi - resolution for PDF rendering (ignored for CBZ); default 300
 */
export async function extractPageAsImage(
  filePath: string,
  format: Format,
  pageNumber: number,
  dpi: number = 300,
): Promise<Buffer> {
  const source = openPageSource(filePath, format);
  try {
    return await source.extractPage(pageNumber, { dpi });
  } finally {
    await source.close();
  }
}
