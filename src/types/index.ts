export type { Format } from '@/lib/page-source/types';
import type { Format } from '@/lib/page-source/types';

export interface Profile {
  id: number;
  name: string;
  avatar: string | null;
  reading_direction: 'rtl' | 'ltr';
  theme: 'dark' | 'light';
  reader_settings: string;
  is_child: number;
}

export type SeriesKind = 'volume' | 'chapter';

export interface Series {
  id: number;
  title: string;
  folder_name: string;
  cover_path: string | null;
  author: string | null;
  description: string | null;
  mangadex_id: string | null;
  kind: SeriesKind;
}

export interface SeriesListItem extends Series {
  volume_count: number;
}

export interface Volume {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  // Possibly fractional for chapter-kind series (e.g. 10.5); whole for volumes.
  volume_number: number | null;
  page_count: number | null;
  format: Format;
}

export interface ProgressEntry {
  volume_id: number;
  current_page: number;
  page_count: number | null;
  updated_at: string;
}

export interface ProgressEntryWithSeries extends ProgressEntry {
  volume_title: string;
  volume_number: number;
  series_id: number;
  series_title: string;
  series_kind: SeriesKind;
}
