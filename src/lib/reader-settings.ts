export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export type PageMode = 'single' | 'spread';

export interface ReaderSettings {
  readingDirection: ReadingDirection;
  tapToTurn: boolean;
  pageMode: PageMode;
  verticalSnap: boolean;
}

export const READER_DEFAULTS: ReaderSettings = {
  readingDirection: 'rtl',
  tapToTurn: false,
  pageMode: 'single',
  verticalSnap: false,
};

export function parseReaderSettings(json: string | null | undefined, fallbackDirection?: string): ReaderSettings {
  let parsed: Partial<ReaderSettings> = {};
  try {
    parsed = JSON.parse(json || '{}');
  } catch {
    // invalid JSON, use defaults
  }

  const merged = { ...READER_DEFAULTS, ...parsed };

  // Backward compat: if JSON has no readingDirection, use the column value
  if (!parsed.readingDirection && fallbackDirection) {
    merged.readingDirection = fallbackDirection === 'ltr' ? 'ltr' : 'rtl';
  }

  return merged;
}
