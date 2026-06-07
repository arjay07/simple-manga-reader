import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { getMangaDir } from './settings';
import type { Format } from './page-source';

const SUPPORTED_EXTENSIONS = ['.pdf', '.cbz'] as const;

function formatFromFilename(filename: string): Format | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.cbz') return 'cbz';
  return null;
}

/**
 * List supported (`.pdf`/`.cbz`) files directly inside `dir`, sorted. Returns an
 * empty array if `dir` does not exist, so callers can probe for an optional
 * `chapters/` subdirectory without a separate existence check.
 */
function listSupportedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((f) => (SUPPORTED_EXTENSIONS as readonly string[]).includes(path.extname(f).toLowerCase()))
    .sort();
}

/**
 * Extract volume number from a filename like "DRAGON BALL VOLUME 01.pdf"
 * or "Series Volume 03.cbz". Works for any recognised extension.
 */
export function extractVolumeNumber(filename: string): number | null {
  const patterns = [/vol(?:ume)?\.?\s*(\d+)/i, /v(\d+)/i, /#(\d+)/i, /(\d+)\.(?:pdf|cbz)$/i];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Extract a possibly-fractional chapter number from a filename like
 * "Chapter 10.5.cbz", "Ch 7.pdf", or "#3.1.cbz". Decimals are preserved so
 * omake/split chapters (10.5, 7.1) sort numerically between whole chapters.
 */
export function extractChapterNumber(filename: string): number | null {
  const patterns = [
    /ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i,
    /#(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\.(?:pdf|cbz)$/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

/**
 * Scan the manga directory and populate the database with series and volumes.
 */
export function scanMangaDirectory(): { seriesCount: number; volumeCount: number } {
  const mangaDir = getMangaDir();
  const db = getDb();

  if (!fs.existsSync(mangaDir)) {
    console.warn(`Manga directory not found: ${mangaDir}`);
    return { seriesCount: 0, volumeCount: 0 };
  }

  // kind is written only when the series row is first created; INSERT OR IGNORE
  // leaves an existing row's kind untouched, so kind is fixed at creation.
  const insertSeries = db.prepare(
    `INSERT OR IGNORE INTO series (title, folder_name, kind) VALUES (?, ?, ?)`,
  );

  const getSeries = db.prepare(`SELECT id FROM series WHERE folder_name = ?`);

  const getVolume = db.prepare(`SELECT id FROM volumes WHERE series_id = ? AND filename = ?`);

  const insertVolume = db.prepare(
    `INSERT INTO volumes (series_id, title, filename, volume_number, format) VALUES (?, ?, ?, ?, ?)`,
  );

  let seriesCount = 0;
  let volumeCount = 0;

  const entries = fs.readdirSync(mangaDir, { withFileTypes: true });

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderName = entry.name;
      const seriesDir = path.join(mangaDir, folderName);

      // Detect kind from the filesystem: a populated `chapters/` subdirectory
      // makes this a chapter series; otherwise it is a volume series. Chapter
      // units store their filename with the `chapters/` prefix so that the
      // existing path-join and cover-cache-key logic resolves them unchanged.
      const chaptersDir = path.join(seriesDir, 'chapters');
      const chapterFiles = listSupportedFiles(chaptersDir);
      const isChapter = chapterFiles.length > 0;

      const flatFiles = listSupportedFiles(seriesDir);
      if (isChapter && flatFiles.length > 0) {
        console.warn(
          `Series "${folderName}" has both flat files and a chapters/ directory; treating it as a chapter series and ignoring the flat files.`,
        );
      }

      const kind = isChapter ? 'chapter' : 'volume';
      const files = isChapter ? chapterFiles.map((f) => path.posix.join('chapters', f)) : flatFiles;

      insertSeries.run(folderName, folderName, kind);
      const series = getSeries.get(folderName) as { id: number };
      seriesCount++;

      for (let i = 0; i < files.length; i++) {
        const filename = files[i];
        const existing = getVolume.get(series.id, filename);
        if (existing) continue;

        const format = formatFromFilename(filename);
        if (!format) continue;

        const baseName = path.basename(filename);
        const number = isChapter
          ? (extractChapterNumber(baseName) ?? i + 1)
          : (extractVolumeNumber(baseName) ?? i + 1);
        const title = path.basename(filename, path.extname(filename));

        insertVolume.run(series.id, title, filename, number, format);
        volumeCount++;
      }
    }
  });

  transaction();

  console.log(`Scan complete: ${seriesCount} series, ${volumeCount} new volumes`);
  return { seriesCount, volumeCount };
}
