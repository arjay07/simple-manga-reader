import { getDb } from './db';
import { assignReadingOrder } from './panel-detect/reading-order';
import type { Panel, RawPanel, PageType } from './panel-detect/types';

/** Columns selected by every panel-data read query; `PanelDataRow` mirrors it. */
const PAGE_COLUMNS = 'page_number, panels_json, page_type, processing_time_ms';

export interface PanelDataRow {
  page_number: number;
  panels_json: string;
  page_type: string;
  processing_time_ms: number | null;
}

export interface PanelDataPage {
  pageNumber: number;
  panels: Panel[];
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
  pageType: PageType,
  processingTimeMs: number,
  confidenceThreshold: number,
): void {
  if (!Number.isInteger(volumeId) || volumeId <= 0) {
    throw new Error(`insertPanelData: volume_id must be a positive integer, got ${volumeId}`);
  }
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    throw new Error(`insertPanelData: page_number must be a positive integer, got ${pageNumber}`);
  }
  if (!Array.isArray(panels)) {
    throw new Error('insertPanelData: panels must be an array');
  }
  const db = getDb();
  // reading_tree_json is a legacy column: no longer read anywhere, written as
  // NULL so previously stored values fade out via the REPLACE.
  db.prepare(
    `INSERT OR REPLACE INTO panel_data
     (volume_id, page_number, panels_json, reading_tree_json, page_type, processing_time_ms, confidence_threshold)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
  ).run(volumeId, pageNumber, JSON.stringify(panels), pageType, processingTimeMs, confidenceThreshold);
}

/**
 * Map a stored row to a {@link PanelDataPage}, deriving reading order at read
 * time. The geometry in `panels_json` *is* the `RawPanel[]` the ordering stage
 * consumed at detection time (`assignReadingOrder` only adds `id`/`readingOrder`
 * and never touches geometry), so we re-run ordering over it here and return the
 * freshly-ordered panels. The stored `readingOrder` is a non-authoritative
 * snapshot and is ignored on read — an ordering-algorithm change thus reaches
 * every stored row on its next read, with no re-detection and no rewrite.
 */
function rowToPage(row: PanelDataRow): PanelDataPage {
  const rawPanels = JSON.parse(row.panels_json) as RawPanel[];
  return {
    pageNumber: row.page_number,
    panels: assignReadingOrder(rawPanels),
    pageType: row.page_type as PageType,
    processingTimeMs: row.processing_time_ms,
  };
}

export function getPanelDataForVolume(volumeId: number): PanelDataPage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${PAGE_COLUMNS} FROM panel_data WHERE volume_id = ? ORDER BY page_number`,
    )
    .all(volumeId) as PanelDataRow[];

  return rows.map(rowToPage);
}

export function getPanelDataForPage(volumeId: number, pageNumber: number): PanelDataPage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ${PAGE_COLUMNS} FROM panel_data WHERE volume_id = ? AND page_number = ?`,
    )
    .get(volumeId, pageNumber) as PanelDataRow | undefined;

  if (!row) return null;

  return rowToPage(row);
}

/**
 * Fetch panel data for a specific set of pages in a single query.
 *
 * At most `limit` pages are fetched (default 50) to bound the IN-clause and the
 * JSON parsing work; callers that genuinely need more may raise it. Pass a
 * smaller value to cap prefetch on hot paths.
 */
export function getPanelDataForPages(
  volumeId: number,
  pageNumbers: number[],
  limit: number = 50,
): PanelDataPage[] {
  if (pageNumbers.length === 0) return [];
  const capped = pageNumbers.slice(0, limit);
  const db = getDb();
  const placeholders = capped.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT ${PAGE_COLUMNS} FROM panel_data WHERE volume_id = ? AND page_number IN (${placeholders})
     ORDER BY page_number`,
    )
    .all(volumeId, ...capped) as PanelDataRow[];

  return rows.map(rowToPage);
}

export function deletePanelDataForVolume(volumeId: number): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM panel_data WHERE volume_id = ?').run(volumeId);
  return result.changes;
}

export function getPanelDataStatus(volumeId: number): PanelDataStatus {
  const db = getDb();
  const volume = db.prepare('SELECT page_count FROM volumes WHERE id = ?').get(volumeId) as
    | { page_count: number | null }
    | undefined;
  const totalPages = volume?.page_count ?? 0;

  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM panel_data WHERE volume_id = ?')
    .get(volumeId) as { cnt: number };
  const processedPages = countRow.cnt;

  return {
    totalPages,
    processedPages,
    isComplete: totalPages > 0 && processedPages >= totalPages,
  };
}
