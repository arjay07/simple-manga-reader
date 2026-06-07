import { getDb } from '@/lib/db';
import type { Profile, Series, SeriesListItem, Volume } from '@/types';

export function getSeries(id: number | string): Series | undefined {
  return getDb()
    .prepare(
      'SELECT id, title, folder_name, cover_path, author, description, mangadex_id, kind, created_at FROM series WHERE id = ?',
    )
    .get(id) as Series | undefined;
}

export function getSeriesList(): SeriesListItem[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.title, s.folder_name, s.cover_path, s.author, s.description, s.mangadex_id, s.kind, s.created_at,
              COUNT(v.id) AS volume_count
       FROM series s
       LEFT JOIN volumes v ON v.series_id = s.id
       GROUP BY s.id
       ORDER BY s.title`,
    )
    .all() as SeriesListItem[];
}

export function getVolume(id: number | string): Volume | undefined {
  return getDb()
    .prepare(
      'SELECT id, series_id, title, filename, volume_number, page_count, format FROM volumes WHERE id = ?',
    )
    .get(id) as Volume | undefined;
}

export function getVolumesBySeries(seriesId: number | string): Volume[] {
  return getDb()
    .prepare(
      'SELECT id, series_id, title, filename, volume_number, page_count, format FROM volumes WHERE series_id = ? ORDER BY volume_number',
    )
    .all(seriesId) as Volume[];
}

export function getProfile(id: number | string): Profile | undefined {
  return getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id) as Profile | undefined;
}
