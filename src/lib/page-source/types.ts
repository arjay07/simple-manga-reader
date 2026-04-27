export type Format = 'pdf' | 'cbz';

export interface PageSource {
  readonly format: Format;
  countPages(): Promise<number>;
  extractPage(pageNumber: number, opts?: { dpi?: number }): Promise<Buffer>;
  close(): Promise<void> | void;
}

export const RECOGNISED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
] as const;

export function isRecognisedImageExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return RECOGNISED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
