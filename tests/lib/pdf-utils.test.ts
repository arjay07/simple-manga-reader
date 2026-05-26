import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/settings', () => ({
  getMangaDir: () => '/test/manga',
}));

import { getVolumeCoverPath, getVolumeThumbnailPath } from '@/lib/pdf-utils';
import path from 'path';

describe('getVolumeCoverPath', () => {
  it('produces vol-<sanitized>.cover.jpg for a PDF filename, preserving the extension', () => {
    const result = getVolumeCoverPath('My Series', 'Vol01.pdf');
    expect(result).toBe(
      path.join('/test/manga', 'My Series', '.covers', 'vol-Vol01_pdf.cover.jpg'),
    );
  });

  it('produces vol-<sanitized>.cover.jpg for a CBZ filename, preserving the extension', () => {
    const result = getVolumeCoverPath('My Series', 'Vol01.cbz');
    expect(result).toBe(
      path.join('/test/manga', 'My Series', '.covers', 'vol-Vol01_cbz.cover.jpg'),
    );
  });

  it('produces distinct paths for PDF and CBZ siblings sharing a stem', () => {
    const pdf = getVolumeCoverPath('My Series', 'Vol01.pdf');
    const cbz = getVolumeCoverPath('My Series', 'Vol01.cbz');
    expect(pdf).not.toBe(cbz);
  });

  it('differs from getVolumeThumbnailPath only by the .cover.jpg vs .jpg suffix', () => {
    const thumb = getVolumeThumbnailPath('My Series', 'Vol01.pdf');
    const cover = getVolumeCoverPath('My Series', 'Vol01.pdf');
    // Thumbnail ends with .jpg, override ends with .cover.jpg; everything before matches.
    expect(thumb.endsWith('.jpg')).toBe(true);
    expect(cover.endsWith('.cover.jpg')).toBe(true);
    expect(cover).toBe(thumb.replace(/\.jpg$/, '.cover.jpg'));
  });

  it('sanitizes non-alphanumeric characters in the filename', () => {
    const result = getVolumeCoverPath('My Series', 'Volume 1 (2024).pdf');
    expect(result).toBe(
      path.join('/test/manga', 'My Series', '.covers', 'vol-Volume_1__2024__pdf.cover.jpg'),
    );
  });
});
