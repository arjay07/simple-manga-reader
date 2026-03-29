import { getDb } from './db';
import type { Panel, ReadingTreeNode, PageType } from './panel-detect/types';

export interface PanelDataRow {
  id: number;
  volume_id: number;
  page_number: number;
  panels_json: string;
  reading_tree_json: string | null;
  page_type: string;
  processing_time_ms: number | null;
  confidence_threshold: number | null;
  created_at: string;
}

export interface PanelDataPage {
  pageNumber: number;
  panels: Panel[];
  readingTree: ReadingTreeNode | null;
  pageType: PageType;
  processingTimeMs: number | null;
}

export interface PanelDataStatus {
  totalPages: number;
  processedPages: number;
  isComplete: boolean;
}

export function insertPanelData(
  volumeId: number,
  pageNumber: number,
  panels: Panel[],
  readingTree: ReadingTreeNode | null,
  pageType: PageType,
  processingTimeMs: number,
  confidenceThreshold: number
): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO panel_data
     (volume_id, page_number, panels_json, reading_tree_json, page_type, processing_time_ms, confidence_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    volumeId,
    pageNumber,
    JSON.stringify(panels),
    readingTree ? JSON.stringify(readingTree) : null,
    pageType,
    processingTimeMs,
    confidenceThreshold
  );
}

export function getPanelDataForVolume(volumeId: number): PanelDataPage[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT page_number, panels_json, reading_tree_json, page_type, processing_time_ms
     FROM panel_data WHERE volume_id = ? ORDER BY page_number`
  ).all(volumeId) as PanelDataRow[];

  return rows.map(row => ({
    pageNumber: row.page_number,
    panels: JSON.parse(row.panels_json) as Panel[],
    readingTree: row.reading_tree_json ? JSON.parse(row.reading_tree_json) as ReadingTreeNode : null,
    pageType: row.page_type as PageType,
    processingTimeMs: row.processing_time_ms,
  }));
}

export function getPanelDataForPage(volumeId: number, pageNumber: number): PanelDataPage | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT page_number, panels_json, reading_tree_json, page_type, processing_time_ms
     FROM panel_data WHERE volume_id = ? AND page_number = ?`
  ).get(volumeId, pageNumber) as PanelDataRow | undefined;

  if (!row) return null;

  return {
    pageNumber: row.page_number,
    panels: JSON.parse(row.panels_json) as Panel[],
    readingTree: row.reading_tree_json ? JSON.parse(row.reading_tree_json) as ReadingTreeNode : null,
    pageType: row.page_type as PageType,
    processingTimeMs: row.processing_time_ms,
  };
}

export function getPanelDataForPages(volumeId: number, pageNumbers: number[]): PanelDataPage[] {
  if (pageNumbers.length === 0) return [];
  const capped = pageNumbers.slice(0, 10);
  const db = getDb();
  const placeholders = capped.map(() => '?').join(', ');
  const rows = db.prepare(
    `SELECT page_number, panels_json, reading_tree_json, page_type, processing_time_ms
     FROM panel_data WHERE volume_id = ? AND page_number IN (${placeholders})
     ORDER BY page_number`
  ).all(volumeId, ...capped) as PanelDataRow[];

  return rows.map(row => ({
    pageNumber: row.page_number,
    panels: JSON.parse(row.panels_json) as Panel[],
    readingTree: row.reading_tree_json ? JSON.parse(row.reading_tree_json) as ReadingTreeNode : null,
    pageType: row.page_type as PageType,
    processingTimeMs: row.processing_time_ms,
  }));
}

export function deletePanelDataForVolume(volumeId: number): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM panel_data WHERE volume_id = ?').run(volumeId);
  return result.changes;
}

export function getPanelDataStatus(volumeId: number): PanelDataStatus {
  const db = getDb();
  const volume = db.prepare('SELECT page_count FROM volumes WHERE id = ?').get(volumeId) as { page_count: number | null } | undefined;
  const totalPages = volume?.page_count ?? 0;

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM panel_data WHERE volume_id = ?').get(volumeId) as { cnt: number };
  const processedPages = countRow.cnt;

  return {
    totalPages,
    processedPages,
    isComplete: totalPages > 0 && processedPages >= totalPages,
  };
}
