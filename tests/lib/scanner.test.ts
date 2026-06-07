import { describe, it, expect } from 'vitest';
import { extractVolumeNumber, extractChapterNumber } from '@/lib/scanner';

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

describe('extractChapterNumber', () => {
  it('parses a whole chapter number', () => {
    expect(extractChapterNumber('Chapter 7.cbz')).toBe(7);
  });

  it('parses a decimal chapter number', () => {
    expect(extractChapterNumber('Ch 10.5.cbz')).toBe(10.5);
  });

  it('parses the abbreviated "Ch." form', () => {
    expect(extractChapterNumber('Ch. 3.pdf')).toBe(3);
  });

  it('parses a decimal after a # marker', () => {
    expect(extractChapterNumber('#3.1.cbz')).toBe(3.1);
  });

  it('falls back to a trailing decimal before the extension', () => {
    expect(extractChapterNumber('My Series 12.5.cbz')).toBe(12.5);
  });

  it('returns null when no number is present', () => {
    expect(extractChapterNumber('Omake Special.cbz')).toBeNull();
  });

  it('sorts decimals between whole chapters', () => {
    const nums = ['Ch 11.cbz', 'Ch 10.5.cbz', 'Ch 10.cbz']
      .map((f) => extractChapterNumber(f) as number)
      .sort((a, b) => a - b);
    expect(nums).toEqual([10, 10.5, 11]);
  });
});
