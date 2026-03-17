import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const mangaDir = process.env.MANGA_DIR ?? '/home/arjay/manga';

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
  const dir = path.join(mangaDir, folderName, '.covers');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the filesystem path for a series cover image.
 */
export function getSeriesCoverPath(folderName: string): string {
  return path.join(mangaDir, folderName, '.covers', 'cover.jpg');
}

/**
 * Get the filesystem path for a volume thumbnail.
 */
export function getVolumeThumbnailPath(folderName: string, volumeId: number | string): string {
  return path.join(mangaDir, folderName, '.covers', `vol-${volumeId}.jpg`);
}
