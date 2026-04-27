'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import JSZip from 'jszip';

export type DocumentFormat = 'pdf' | 'cbz';

export interface PageViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PageRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface DocumentPage {
  getViewport(opts: { scale: number }): PageViewport;
  render(opts: { canvas: HTMLCanvasElement; viewport: PageViewport }): PageRenderTask;
}

export interface DocumentSource {
  readonly format: DocumentFormat;
  readonly numPages: number;
  getPage(pageNum: number): Promise<DocumentPage>;
  destroy(): void;
}

const RECOGNISED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

function isRecognisedImageExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return RECOGNISED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isSkippableEntry(name: string): boolean {
  if (name.startsWith('__MACOSX/') || name.includes('/__MACOSX/')) return true;
  const segments = name.split('/');
  const base = segments[segments.length - 1];
  if (base === 'Thumbs.db' || base === 'thumbs.db') return true;
  if (base.toLowerCase() === 'comicinfo.xml') return true;
  if (segments.some((seg) => seg.startsWith('.'))) return true;
  return false;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export class PdfDocumentSource implements DocumentSource {
  readonly format = 'pdf' as const;
  readonly numPages: number;

  private constructor(private readonly pdfDoc: PDFDocumentProxy) {
    this.numPages = pdfDoc.numPages;
  }

  static async load(url: string): Promise<PdfDocumentSource> {
    // Polyfill Map.prototype.getOrInsertComputed (required by pdfjs-dist ≥5.5)
    type MapPolyfilled = { getOrInsertComputed?: <K, V>(key: K, cb: (key: K) => V) => V };
    const proto = Map.prototype as Map<unknown, unknown> & MapPolyfilled;
    if (typeof proto.getOrInsertComputed === 'undefined') {
      proto.getOrInsertComputed = function <K, V>(this: Map<K, V>, key: K, cb: (key: K) => V): V {
        if (this.has(key)) return this.get(key) as V;
        const value = cb(key);
        this.set(key, value);
        return value;
      };
    }

    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    const doc = await getDocument(url).promise;
    return new PdfDocumentSource(doc);
  }

  async getPage(pageNum: number): Promise<DocumentPage> {
    const page: PDFPageProxy = await this.pdfDoc.getPage(pageNum);
    return {
      getViewport: ({ scale }) => {
        const vp = page.getViewport({ scale });
        return { width: vp.width, height: vp.height, scale };
      },
      render: ({ canvas, viewport }) => {
        const pdfVp = page.getViewport({ scale: viewport.scale });
        const task = page.render({ canvas, viewport: pdfVp });
        return {
          promise: task.promise.then(() => undefined),
          cancel: () => task.cancel(),
        };
      },
    };
  }

  destroy(): void {
    this.pdfDoc.destroy();
  }
}

export class CbzDocumentSource implements DocumentSource {
  readonly format = 'cbz' as const;
  readonly numPages: number;

  private static readonly CACHE_LIMIT = 5;
  private readonly cache = new Map<number, Promise<HTMLImageElement>>();
  private readonly cacheOrder: number[] = [];

  private constructor(
    private readonly zip: JSZip,
    private readonly entryNames: string[]
  ) {
    this.numPages = entryNames.length;
  }

  static async load(url: string): Promise<CbzDocumentSource> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch CBZ archive (HTTP ${res.status})`);
    }
    const buf = await res.arrayBuffer();
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Could not parse CBZ archive (not a ZIP or corrupt): ${msg}`);
    }

    const names: string[] = [];
    zip.forEach((relativePath, file) => {
      if (file.dir) return;
      if (isSkippableEntry(relativePath)) return;
      if (!isRecognisedImageExtension(relativePath)) return;
      names.push(relativePath);
    });

    if (names.length === 0) {
      throw new Error('CBZ archive contains no recognised image entries');
    }

    names.sort(collator.compare);
    return new CbzDocumentSource(zip, names);
  }

  private mimeFromExtension(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.avif')) return 'image/avif';
    return 'application/octet-stream';
  }

  private trackCache(pageNum: number): void {
    const existingIdx = this.cacheOrder.indexOf(pageNum);
    if (existingIdx >= 0) this.cacheOrder.splice(existingIdx, 1);
    this.cacheOrder.push(pageNum);
    while (this.cacheOrder.length > CbzDocumentSource.CACHE_LIMIT) {
      const oldest = this.cacheOrder.shift();
      if (oldest != null) this.cache.delete(oldest);
    }
  }

  private loadImage(pageNum: number): Promise<HTMLImageElement> {
    const existing = this.cache.get(pageNum);
    if (existing) {
      this.trackCache(pageNum);
      return existing;
    }

    const promise = (async () => {
      const entryName = this.entryNames[pageNum - 1];
      const file = this.zip.file(entryName);
      if (!file) {
        throw new Error(`CBZ entry not found: ${entryName}`);
      }
      const arrayBuffer = await file.async('arraybuffer');
      const blob = new Blob([arrayBuffer], { type: this.mimeFromExtension(entryName) });
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to decode CBZ image: ${entryName}`));
          img.src = objectUrl;
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    })();

    this.cache.set(pageNum, promise);
    this.trackCache(pageNum);
    return promise;
  }

  async getPage(pageNum: number): Promise<DocumentPage> {
    if (pageNum < 1 || pageNum > this.numPages) {
      throw new Error(`Page ${pageNum} out of range (archive has ${this.numPages} pages)`);
    }
    const img = await this.loadImage(pageNum);
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    return {
      getViewport: ({ scale }) => ({
        width: naturalWidth * scale,
        height: naturalHeight * scale,
        scale,
      }),
      render: ({ canvas, viewport }) => {
        let cancelled = false;
        const promise = (async () => {
          if (cancelled) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, viewport.width, viewport.height);
        })();
        return {
          promise,
          cancel: () => {
            cancelled = true;
          },
        };
      },
    };
  }

  destroy(): void {
    this.cache.clear();
    this.cacheOrder.length = 0;
  }
}

export async function loadDocumentSource(
  url: string,
  format: DocumentFormat
): Promise<DocumentSource> {
  if (format === 'cbz') return CbzDocumentSource.load(url);
  return PdfDocumentSource.load(url);
}
