import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH ?? 'data/manga-reader.db'
  );

  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT,
      reading_direction TEXT DEFAULT 'rtl',
      theme TEXT DEFAULT 'dark',
      reader_settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      folder_name TEXT NOT NULL UNIQUE,
      cover_path TEXT,
      author TEXT,
      description TEXT,
      mangadex_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS volumes (
      id INTEGER PRIMARY KEY,
      series_id INTEGER REFERENCES series(id),
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      volume_number INTEGER,
      page_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY,
      profile_id INTEGER REFERENCES profiles(id),
      volume_id INTEGER REFERENCES volumes(id),
      current_page INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, volume_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add reader_settings column if missing (existing DBs)
  const columns = db.pragma('table_info(profiles)') as { name: string }[];
  if (!columns.some((c) => c.name === 'reader_settings')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN reader_settings TEXT DEFAULT '{}'`);
  }

  // Migration: add mangadex_id column if missing (existing DBs)
  const seriesColumns = db.pragma('table_info(series)') as { name: string }[];
  if (!seriesColumns.some((c) => c.name === 'mangadex_id')) {
    db.exec(`ALTER TABLE series ADD COLUMN mangadex_id TEXT`);
  }

  return db;
}
