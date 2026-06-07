import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '@/lib/db';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('series.kind schema', () => {
  it('declares a kind column on series', () => {
    const db = freshDb();
    const cols = db.pragma('table_info(series)') as { name: string }[];
    expect(cols.some((c) => c.name === 'kind')).toBe(true);
    db.close();
  });

  it("defaults kind to 'volume' for rows inserted without it", () => {
    const db = freshDb();
    db.prepare("INSERT INTO series (title, folder_name) VALUES ('S', 'S')").run();
    const row = db.prepare('SELECT kind FROM series WHERE folder_name = ?').get('S') as {
      kind: string;
    };
    expect(row.kind).toBe('volume');
    db.close();
  });
});

describe('volumes.volume_number is REAL', () => {
  it('round-trips a fractional chapter number without truncation', () => {
    const db = freshDb();
    db.prepare("INSERT INTO series (id, title, folder_name, kind) VALUES (1, 'S', 'S', 'chapter')").run();
    db.prepare(
      "INSERT INTO volumes (series_id, title, filename, volume_number, format) VALUES (1, 'Ch 10.5', 'chapters/Ch 10.5.cbz', ?, 'cbz')",
    ).run(10.5);
    const row = db.prepare('SELECT volume_number FROM volumes').get() as { volume_number: number };
    expect(row.volume_number).toBe(10.5);
    db.close();
  });

  it('orders decimals numerically between whole numbers', () => {
    const db = freshDb();
    db.prepare("INSERT INTO series (id, title, folder_name, kind) VALUES (1, 'S', 'S', 'chapter')").run();
    const insert = db.prepare(
      "INSERT INTO volumes (series_id, title, filename, volume_number, format) VALUES (1, ?, ?, ?, 'cbz')",
    );
    for (const n of [11, 10, 10.5]) {
      insert.run(`Ch ${n}`, `chapters/Ch ${n}.cbz`, n);
    }
    const ordered = db
      .prepare('SELECT volume_number FROM volumes ORDER BY volume_number')
      .all() as { volume_number: number }[];
    expect(ordered.map((r) => r.volume_number)).toEqual([10, 10.5, 11]);
    db.close();
  });
});
