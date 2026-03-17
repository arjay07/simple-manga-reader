import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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
 * Ensure the volume covers directory exists.
 */
export function ensureVolumeCoverDir(): string {
  const dir = path.join(process.cwd(), 'public', 'covers', 'volumes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
