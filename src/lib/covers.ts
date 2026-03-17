import fs from 'fs';
import path from 'path';
import { getDb } from './db';

/**
 * Returns the cover image path for a series if one exists.
 * Checks the database cover_path first, then falls back to
 * the default location at public/covers/{seriesId}.jpg.
 */
export function getCoverPath(seriesId: number | string): string | null {
  const db = getDb();
  const series = db
    .prepare('SELECT cover_path FROM series WHERE id = ?')
    .get(seriesId) as { cover_path: string | null } | undefined;

  if (series?.cover_path) {
    const fullPath = path.join(process.cwd(), 'public', series.cover_path);
    if (fs.existsSync(fullPath)) {
      return series.cover_path;
    }
  }

  // Check default location
  const defaultPath = path.join(
    process.cwd(),
    'public',
    'covers',
    `${seriesId}.jpg`
  );
  if (fs.existsSync(defaultPath)) {
    return `/covers/${seriesId}.jpg`;
  }

  return null;
}

/**
 * Returns the path where a generated cover image should be stored
 * for the given series.
 */
export function generateCoverPath(seriesId: number | string): string {
  return `/covers/${seriesId}.jpg`;
}
