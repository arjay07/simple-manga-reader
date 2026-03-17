import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getMangaDir } from './settings';

/**
 * Check if pdftoppm is available on the system.
 */
export function isPdftoppmAvailable(): boolean {
  try {
    execSync('which pdftoppm', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract page 1 of a PDF as JPEG using pdftoppm at 150 DPI.
 * Returns the path to the generated JPEG file.
 */
export function extractFirstPage(pdfPath: string, outputPath: string): string {
  // pdftoppm appends the suffix, so we need to strip .jpg from the prefix
  const outputPrefix = outputPath.replace(/\.jpg$/, '');

  execFileSync('pdftoppm', [
    '-jpeg',
    '-f', '1',
    '-l', '1',
    '-r', '150',
    '-singlefile',
    pdfPath,
    outputPrefix,
  ]);

  // pdftoppm creates outputPrefix.jpg
  const generatedPath = outputPrefix + '.jpg';
  if (!fs.existsSync(generatedPath)) {
    throw new Error(`pdftoppm did not generate expected file: ${generatedPath}`);
  }

  return generatedPath;
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
 * Get the filesystem path for a volume thumbnail.
 * Uses a sanitized version of the PDF filename as the cache key so that
 * thumbnails survive database ID changes (e.g. after a DB reset + rescan).
 */
export function getVolumeThumbnailPath(folderName: string, volumeFilename: string): string {
  // Strip the .pdf extension and replace non-alphanumeric chars for a safe filename
  const baseName = volumeFilename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getMangaDir(), folderName, '.covers', `vol-${baseName}.jpg`);
}
