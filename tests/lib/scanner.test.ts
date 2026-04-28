import { describe, it, expect } from 'vitest';
import { extractVolumeNumber } from '@/lib/scanner';

describe('extractVolumeNumber', () => {
  it('parses Vol01.pdf', () => {
    expect(extractVolumeNumber('Vol01.pdf')).toBe(1);
  });

  it('parses Vol01.cbz', () => {
    expect(extractVolumeNumber('Vol01.cbz')).toBe(1);
  });

  it('parses #3.cbz', () => {
    expect(extractVolumeNumber('#3.cbz')).toBe(3);
  });

  it('parses VOLUME 42.PDF case-insensitively', () => {
    expect(extractVolumeNumber('VOLUME 42.PDF')).toBe(42);
  });

  it('parses Volume 03.cbz with full word', () => {
    expect(extractVolumeNumber('Series Volume 03.cbz')).toBe(3);
  });

  it('parses v07 prefix', () => {
    expect(extractVolumeNumber('Series v07.pdf')).toBe(7);
  });

  it('returns null for filename with no number', () => {
    expect(extractVolumeNumber('Cover.pdf')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractVolumeNumber('')).toBeNull();
  });

  it('falls back to trailing digits before extension', () => {
    expect(extractVolumeNumber('Series 12.pdf')).toBe(12);
  });
});
