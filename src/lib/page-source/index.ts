import type { Format, PageSource } from './types';
import { PdfPageSource } from './pdf';
import { CbzPageSource } from './cbz';

export type { Format, PageSource } from './types';
export { isRecognisedImageExtension, RECOGNISED_IMAGE_EXTENSIONS } from './types';

export function openPageSource(filePath: string, format: Format): PageSource {
  switch (format) {
    case 'pdf':
      return new PdfPageSource(filePath);
    case 'cbz':
      return new CbzPageSource(filePath);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported page source format: ${exhaustive as string}`);
    }
  }
}
