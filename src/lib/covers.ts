import fs from 'fs';
import { getSeriesCoverPath, ensureCoversDir } from './pdf-utils';
import { getDb } from './db';

/**
 * Returns the absolute filesystem path for a series cover if one exists.
 */
export function getCoverPath(seriesId: number | string): string | null {
  const db = getDb();
  const series = db
    .prepare('SELECT folder_name FROM series WHERE id = ?')
    .get(seriesId) as { folder_name: string } | undefined;

  if (!series) return null;

  const coverPath = getSeriesCoverPath(series.folder_name);
  if (fs.existsSync(coverPath)) {
    return coverPath;
  }

  return null;
}

/**
 * Save a buffer as the series cover image.
 */
export function saveCover(seriesId: number | string, folderName: string, buffer: Buffer): void {
  ensureCoversDir(folderName);
  const coverPath = getSeriesCoverPath(folderName);
  fs.writeFileSync(coverPath, buffer);

  const db = getDb();
  db.prepare('UPDATE series SET cover_path = ? WHERE id = ?').run(coverPath, seriesId);
}
