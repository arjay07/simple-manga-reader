import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getMangaDir } from './settings';

/**
 * Check if pdftoppm is available on the system. Cross-platform: uses `where`
 * on Windows and `which` elsewhere. Used by `PdfPageSource` to decide whether
 * to shell out to pdftoppm or fall back to the bundled mupdf renderer.
 */
export function isPdftoppmAvailable(): boolean {
  const probe = process.platform === 'win32' ? 'where pdftoppm' : 'which pdftoppm';
  try {
    execSync(probe, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the .covers directory exists for a series folder.
 * Returns the absolute path to the .covers directory.
 */
export function ensureCoversDir(folderName: string): string {
  const dir = path.join(getMangaDir(), folderName, '.covers');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the filesystem path for a series cover image.
 */
export function getSeriesCoverPath(folderName: string): string {
  return path.join(getMangaDir(), folderName, '.covers', 'cover.jpg');
}

/**
 * Get the filesystem path for a volume thumbnail. The cache key keeps the
 * file extension encoded so that two volumes sharing a stem but differing
 * in format (e.g. `Vol01.pdf` and `Vol01.cbz`) resolve to distinct files.
 */
export function getVolumeThumbnailPath(folderName: string, volumeFilename: string): string {
  // Replace non-alphanumeric chars (including the dot) with `_` so the extension
  // is preserved as part of the key rather than stripped.
  const baseName = volumeFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getMangaDir(), folderName, '.covers', `vol-${baseName}.jpg`);
}
