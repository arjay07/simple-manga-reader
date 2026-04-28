import { execFileSync } from 'child_process';
import fs from 'fs';
import { isPdftoppmAvailable } from '../pdf-utils';
import type { PageSource } from './types';

const DEFAULT_DPI = 300;

export class PdfPageSource implements PageSource {
  readonly format = 'pdf' as const;
  private cachedPageCount: number | null = null;

  constructor(private readonly filePath: string) {}

  async countPages(): Promise<number> {
    if (this.cachedPageCount !== null) return this.cachedPageCount;
    const mupdf = await import('mupdf');
    const fileData = fs.readFileSync(this.filePath);
    const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
    const count = doc.countPages();
    this.cachedPageCount = count;
    return count;
  }

  async extractPage(pageNumber: number, opts?: { dpi?: number }): Promise<Buffer> {
    const dpi = opts?.dpi ?? DEFAULT_DPI;

    if (isPdftoppmAvailable()) {
      const result = execFileSync(
        'pdftoppm',
        [
          '-png',
          '-f',
          String(pageNumber),
          '-l',
          String(pageNumber),
          '-r',
          String(dpi),
          '-singlefile',
          this.filePath,
        ],
        { maxBuffer: 50 * 1024 * 1024 },
      );
      return Buffer.from(result);
    }

    return extractWithMupdf(this.filePath, pageNumber, dpi);
  }

  close(): void {
    // pdftoppm/mupdf paths are stateless; nothing to release.
  }
}

async function extractWithMupdf(pdfPath: string, pageNumber: number, dpi: number): Promise<Buffer> {
  const mupdf = await import('mupdf');
  const fileData = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
  const page = doc.loadPage(pageNumber - 1);

  const scale = dpi / 72;
  const matrix = mupdf.Matrix.scale(scale, scale);

  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  const pngBuffer = pixmap.asPNG();

  return Buffer.from(pngBuffer);
}
