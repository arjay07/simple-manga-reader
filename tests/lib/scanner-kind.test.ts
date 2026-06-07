import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SCHEMA_SQL } from '@/lib/db';

// Swappable in-memory db + manga dir, read by the hoisted mocks below.
const holder = vi.hoisted(() => ({
  db: null as unknown as import('better-sqlite3').Database,
  mangaDir: '',
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getDb: () => holder.db };
});

vi.mock('@/lib/settings', () => ({
  getMangaDir: () => holder.mangaDir,
}));

import { scanMangaDirectory } from '@/lib/scanner';

function touch(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '');
}

function seriesRow(folder: string) {
  return holder.db.prepare('SELECT id, kind FROM series WHERE folder_name = ?').get(folder) as
    | { id: number; kind: string }
    | undefined;
}

function unitsFor(seriesId: number) {
  return holder.db
    .prepare('SELECT filename, volume_number FROM volumes WHERE series_id = ? ORDER BY volume_number')
    .all(seriesId) as { filename: string; volume_number: number }[];
}

describe('scanMangaDirectory kind detection', () => {
  beforeEach(() => {
    holder.db = new Database(':memory:');
    holder.db.exec(SCHEMA_SQL);
    holder.mangaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manga-scan-'));
  });

  afterEach(() => {
    holder.db.close();
    fs.rmSync(holder.mangaDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('flat files create a volume series, unchanged', () => {
    touch(path.join(holder.mangaDir, 'Naruto', 'Vol01.cbz'));
    touch(path.join(holder.mangaDir, 'Naruto', 'Vol02.cbz'));
    scanMangaDirectory();

    const series = seriesRow('Naruto')!;
    expect(series.kind).toBe('volume');
    const units = unitsFor(series.id);
    expect(units.map((u) => u.filename)).toEqual(['Vol01.cbz', 'Vol02.cbz']);
    expect(units.map((u) => u.volume_number)).toEqual([1, 2]);
  });

  it('a chapters/ subdirectory creates a chapter series with prefixed filenames and decimals', () => {
    touch(path.join(holder.mangaDir, 'OnePiece', 'chapters', 'Ch 10.cbz'));
    touch(path.join(holder.mangaDir, 'OnePiece', 'chapters', 'Ch 10.5.cbz'));
    touch(path.join(holder.mangaDir, 'OnePiece', 'chapters', 'Ch 11.cbz'));
    scanMangaDirectory();

    const series = seriesRow('OnePiece')!;
    expect(series.kind).toBe('chapter');
    const units = unitsFor(series.id);
    expect(units.map((u) => u.filename)).toEqual([
      'chapters/Ch 10.cbz',
      'chapters/Ch 10.5.cbz',
      'chapters/Ch 11.cbz',
    ]);
    expect(units.map((u) => u.volume_number)).toEqual([10, 10.5, 11]);
  });

  it('a folder with both flat files and chapters/ is a chapter series and ignores the flat files', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    touch(path.join(holder.mangaDir, 'Mixed', 'Vol01.cbz'));
    touch(path.join(holder.mangaDir, 'Mixed', 'chapters', 'Ch 1.cbz'));
    scanMangaDirectory();

    const series = seriesRow('Mixed')!;
    expect(series.kind).toBe('chapter');
    const units = unitsFor(series.id);
    expect(units.map((u) => u.filename)).toEqual(['chapters/Ch 1.cbz']);
    expect(warn).toHaveBeenCalled();
  });

  it('does not re-kind an existing series on rescan', () => {
    // First scan: flat ⇒ volume.
    touch(path.join(holder.mangaDir, 'Bleach', 'Vol01.cbz'));
    scanMangaDirectory();
    expect(seriesRow('Bleach')!.kind).toBe('volume');

    // A chapters/ dir appears later; rescan must keep kind = 'volume'.
    touch(path.join(holder.mangaDir, 'Bleach', 'chapters', 'Ch 1.cbz'));
    scanMangaDirectory();
    expect(seriesRow('Bleach')!.kind).toBe('volume');
  });
});
