import { describe, it, expect } from 'vitest';
import { parseReaderSettings, READER_DEFAULTS } from '@/lib/reader-settings';

describe('parseReaderSettings', () => {
  it('returns defaults when input is null', () => {
    expect(parseReaderSettings(null)).toEqual(READER_DEFAULTS);
  });

  it('returns defaults when input is undefined', () => {
    expect(parseReaderSettings(undefined)).toEqual(READER_DEFAULTS);
  });

  it('returns defaults when input is empty string', () => {
    expect(parseReaderSettings('')).toEqual(READER_DEFAULTS);
  });

  it('returns defaults when JSON is malformed', () => {
    expect(parseReaderSettings('{not-json')).toEqual(READER_DEFAULTS);
  });

  it('merges partial keys with defaults', () => {
    const result = parseReaderSettings(JSON.stringify({ tapToTurn: true }));
    expect(result.tapToTurn).toBe(true);
    expect(result.readingDirection).toBe(READER_DEFAULTS.readingDirection);
    expect(result.pageMode).toBe(READER_DEFAULTS.pageMode);
    expect(result.verticalSnap).toBe(READER_DEFAULTS.verticalSnap);
  });

  it('respects all-keys override', () => {
    const all = {
      readingDirection: 'ltr',
      tapToTurn: true,
      tapToAdvancePanel: true,
      pageMode: 'spread',
      verticalSnap: true,
    };
    expect(parseReaderSettings(JSON.stringify(all))).toEqual(all);
  });

  it('uses fallbackDirection when JSON omits readingDirection', () => {
    const result = parseReaderSettings('{}', 'ltr');
    expect(result.readingDirection).toBe('ltr');
  });

  it('coerces unknown fallbackDirection to rtl', () => {
    const result = parseReaderSettings('{}', 'something-else');
    expect(result.readingDirection).toBe('rtl');
  });

  it('explicit JSON readingDirection wins over fallback', () => {
    const result = parseReaderSettings(
      JSON.stringify({ readingDirection: 'vertical' }),
      'ltr',
    );
    expect(result.readingDirection).toBe('vertical');
  });
});
