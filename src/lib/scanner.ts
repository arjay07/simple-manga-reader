import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { getMangaDir } from './settings';

/**
 * Extract volume number from a filename like "DRAGON BALL VOLUME 01.pdf"
 */
export function extractVolumeNumber(filename: string): number | null {
  // Match common patterns: "Volume 01", "Vol. 3", "v02", "#5", or standalone numbers
  const patterns = [
    /vol(?:ume)?\.?\s*(\d+)/i,
    /v(\d+)/i,
    /#(\d+)/i,
    /(\d+)\.pdf$/i,
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
    `INSERT INTO volumes (series_id, title, filename, volume_number) VALUES (?, ?, ?, ?)`
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
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .sort();

      for (let i = 0; i < files.length; i++) {
        const filename = files[i];
        const existing = getVolume.get(series.id, filename);
        if (existing) continue;

        const volumeNumber = extractVolumeNumber(filename) ?? (i + 1);
        const title = path.basename(filename, '.pdf');

        insertVolume.run(series.id, title, filename, volumeNumber);
        volumeCount++;
      }
    }
  });

  transaction();

  console.log(`Scan complete: ${seriesCount} series, ${volumeCount} new volumes`);
  return { seriesCount, volumeCount };
}
