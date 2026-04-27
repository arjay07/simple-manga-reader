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
 * Extract volume number from a filename like "DRAGON BALL VOLUME 01.pdf"
 * or "Series Volume 03.cbz". Works for any recognised extension.
 */
export function extractVolumeNumber(filename: string): number | null {
  const patterns = [
    /vol(?:ume)?\.?\s*(\d+)/i,
    /v(\d+)/i,
    /#(\d+)/i,
    /(\d+)\.(?:pdf|cbz)$/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
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

  const insertSeries = db.prepare(
    `INSERT OR IGNORE INTO series (title, folder_name) VALUES (?, ?)`
  );

  const getSeries = db.prepare(
    `SELECT id FROM series WHERE folder_name = ?`
  );

  const getVolume = db.prepare(
    `SELECT id FROM volumes WHERE series_id = ? AND filename = ?`
  );

  const insertVolume = db.prepare(
    `INSERT INTO volumes (series_id, title, filename, volume_number, format) VALUES (?, ?, ?, ?, ?)`
  );

  let seriesCount = 0;
  let volumeCount = 0;

  const entries = fs.readdirSync(mangaDir, { withFileTypes: true });

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderName = entry.name;
      insertSeries.run(folderName, folderName);
      const series = getSeries.get(folderName) as { id: number };
      seriesCount++;

      const volumeDir = path.join(mangaDir, folderName);
      const files = fs.readdirSync(volumeDir)
        .filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
        })
        .sort();

      for (let i = 0; i < files.length; i++) {
        const filename = files[i];
        const existing = getVolume.get(series.id, filename);
        if (existing) continue;

        const format = formatFromFilename(filename);
        if (!format) continue;

        const volumeNumber = extractVolumeNumber(filename) ?? (i + 1);
        const title = path.basename(filename, path.extname(filename));

        insertVolume.run(series.id, title, filename, volumeNumber, format);
        volumeCount++;
      }
    }
  });

  transaction();

  console.log(`Scan complete: ${seriesCount} series, ${volumeCount} new volumes`);
  return { seriesCount, volumeCount };
}
