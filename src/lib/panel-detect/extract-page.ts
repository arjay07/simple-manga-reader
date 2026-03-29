import { execFileSync } from 'child_process';
import { isPdftoppmAvailable } from '../pdf-utils';
import fs from 'fs';
import path from 'path';

/**
 * Extract a single page from a PDF as a PNG buffer.
 * Tries pdftoppm first (fast, high quality), falls back to mupdf (WASM, cross-platform).
 * @param pdfPath - absolute path to the PDF file
 * @param pageNumber - 1-based page number
 * @param dpi - resolution (default 300 for good detection quality)
 * @returns PNG image as a Buffer
 */
export async function extractPageAsImage(
  pdfPath: string,
  pageNumber: number,
  dpi: number = 300
): Promise<Buffer> {
  if (isPdftoppmAvailable()) {
    const result = execFileSync('pdftoppm', [
      '-png',
      '-f', String(pageNumber),
      '-l', String(pageNumber),
      '-r', String(dpi),
      '-singlefile',
      pdfPath,
    ], {
      maxBuffer: 50 * 1024 * 1024,
    });
    return Buffer.from(result);
  }

  // Fallback: mupdf (WASM-based, works everywhere)
  return extractWithMupdf(pdfPath, pageNumber, dpi);
}

async function extractWithMupdf(
  pdfPath: string,
  pageNumber: number,
  dpi: number
): Promise<Buffer> {
  const mupdf = await import('mupdf');

  const fileData = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
  const page = doc.loadPage(pageNumber - 1); // mupdf uses 0-based index

  // Calculate transform matrix from DPI (PDF default is 72 DPI)
  const scale = dpi / 72;
  const matrix = mupdf.Matrix.scale(scale, scale);

  // Render to pixmap
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  const pngBuffer = pixmap.asPNG();

  return Buffer.from(pngBuffer);
}
