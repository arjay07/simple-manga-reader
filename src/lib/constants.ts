import type { Format } from '@/lib/page-source/types';

export type { Format };

export const FORMAT = {
  PDF: 'pdf' as const,
  CBZ: 'cbz' as const,
} satisfies Record<string, Format>;

export const STORAGE_KEYS = {
  theme: 'theme',
  adminMode: 'admin-mode',
  profileId: 'profileId',
  smartPanelZoom: 'smartPanelZoom',
  focusMode: 'focusMode',
  debugMode: 'debugMode',
  progress: (profileId: number | string, volumeId: number | string) =>
    `progress:${profileId}:${volumeId}`,
} as const;

export const MIME_TYPES = {
  pdf: 'application/pdf',
  cbz: 'application/vnd.comicbook+zip',
} as const;

export function mimeTypeForFormat(format: Format): string {
  return format === 'cbz' ? MIME_TYPES.cbz : MIME_TYPES.pdf;
}
