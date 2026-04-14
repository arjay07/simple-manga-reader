import path from 'path';
import fs from 'fs';
import { getDb } from '../db';
import { getMangaDir } from '../settings';
import { insertPanelData, getPanelDataForPage } from '../panel-data';
import { extractPageAsImage } from './extract-page';
import { detectPanelsMl } from './ml';
import { assignReadingOrder } from './reading-order';

export type JobStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface PageSummary {
  pageNumber: number;
  panelCount: number;
  pageType: string;
  processingTimeMs: number;
  error?: string;
}

export interface JobState {
  status: JobStatus;
  volumeId?: number;
  volumeTitle?: string;
  seriesTitle?: string;
  totalPages: number;
  processedPages: number;
  skippedPages: number;
  currentPage: number;
  startedAt?: number;
  pagesPerSecond: number;
  confidenceThreshold: number;
  pages: PageSummary[];
  error?: string;
}

class JobManager {
  private status: JobStatus = 'idle';
  private volumeId = 0;
  private volumeTitle = '';
  private seriesTitle = '';
  private totalPages = 0;
  private processedPages = 0;
  private skippedPages = 0;
  private currentPage = 0;
  private startedAt = 0;
  private confidenceThreshold = 0.25;
  private pages: PageSummary[] = [];
  private error?: string;

  private paused = false;
  private cancelled = false;
  private resumeResolve: (() => void) | null = null;

  getState(): JobState {
    const elapsed = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
    const processed = this.processedPages + this.skippedPages;
    return {
      status: this.status,
      volumeId: this.volumeId || undefined,
      volumeTitle: this.volumeTitle || undefined,
      seriesTitle: this.seriesTitle || undefined,
      totalPages: this.totalPages,
      processedPages: processed,
      skippedPages: this.skippedPages,
      currentPage: this.currentPage,
      startedAt: this.startedAt || undefined,
      pagesPerSecond: elapsed > 0 ? Math.round((processed / elapsed) * 100) / 100 : 0,
      confidenceThreshold: this.confidenceThreshold,
      pages: this.pages,
      error: this.error,
    };
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }

  async start(volumeId: number, confidenceThreshold: number, force: boolean): Promise<void> {
    if (this.isActive()) {
      throw new Error('A job is already active');
    }

    const db = getDb();
    const volume = db.prepare(
      `SELECT v.id, v.page_count, v.title as volume_title, s.title as series_title, s.folder_name, v.filename
       FROM volumes v JOIN series s ON v.series_id = s.id
       WHERE v.id = ?`
    ).get(volumeId) as {
      id: number; page_count: number | null;
      volume_title: string; series_title: string;
      folder_name: string; filename: string;
    } | undefined;

    if (!volume) {
      throw new Error('Volume not found');
    }

    const pdfPath = path.join(getMangaDir(), volume.folder_name, volume.filename);
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file not found on disk');
    }

    // If page_count is missing, count pages from the PDF
    let pageCount = volume.page_count;
    if (!pageCount || pageCount < 1) {
      const mupdf = await import('mupdf');
      const fileData = fs.readFileSync(pdfPath);
      const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
      pageCount = doc.countPages();
      // Update the DB so future lookups have it
      db.prepare('UPDATE volumes SET page_count = ? WHERE id = ?').run(pageCount, volumeId);
    }

    if (pageCount < 1) {
      throw new Error('Volume has no pages');
    }

    if (force) {
      db.prepare('DELETE FROM panel_data WHERE volume_id = ?').run(volumeId);
    }

    // Reset state
    this.volumeId = volumeId;
    this.volumeTitle = volume.volume_title;
    this.seriesTitle = volume.series_title;
    this.totalPages = pageCount;
    this.processedPages = 0;
    this.skippedPages = 0;
    this.currentPage = 0;
    this.startedAt = Date.now();
    this.confidenceThreshold = confidenceThreshold;
    this.pages = [];
    this.error = undefined;
    this.paused = false;
    this.cancelled = false;
    this.status = 'running';

    // Fire and forget — the loop runs in the background
    this.processLoop(pdfPath).catch(err => {
      console.error('Panel generation job fatal error:', err);
      this.error = err instanceof Error ? err.message : 'Unknown error';
      this.status = 'error';
    });
  }

  pause(): void {
    if (this.status !== 'running') {
      throw new Error('No running job to pause');
    }
    this.paused = true;
    this.status = 'paused';
  }

  resume(): void {
    if (this.status !== 'paused') {
      throw new Error('No paused job to resume');
    }
    this.paused = false;
    this.status = 'running';
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  cancel(): void {
    if (!this.isActive()) {
      throw new Error('No active job to cancel');
    }
    this.cancelled = true;
    this.paused = false;
    this.status = 'idle';
    // If waiting on pause, unblock
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await new Promise<void>(resolve => {
        this.resumeResolve = resolve;
      });
    }
  }

  private async processLoop(pdfPath: string): Promise<void> {
    for (let page = 1; page <= this.totalPages; page++) {
      await this.waitIfPaused();
      if (this.cancelled) break;

      this.currentPage = page;

      // Skip if already processed
      const existing = getPanelDataForPage(this.volumeId, page);
      if (existing) {
        this.skippedPages++;
        this.pages.push({
          pageNumber: page,
          panelCount: existing.panels.length,
          pageType: existing.pageType,
          processingTimeMs: existing.processingTimeMs ?? 0,
        });
        continue;
      }

      // Yield to the event loop so HTTP requests aren't starved during inference
      await new Promise<void>(resolve => setImmediate(resolve));

      try {
        const start = Date.now();
        const imageBuffer = await extractPageAsImage(pdfPath, page);
        const detection = await detectPanelsMl(imageBuffer, this.confidenceThreshold);
        const { panels, readingTree } = assignReadingOrder(detection.panels);
        const processingTimeMs = Date.now() - start;

        insertPanelData(
          this.volumeId,
          page,
          panels,
          readingTree,
          detection.pageType,
          processingTimeMs,
          this.confidenceThreshold
        );

        this.processedPages++;
        this.pages.push({
          pageNumber: page,
          panelCount: panels.length,
          pageType: detection.pageType,
          processingTimeMs,
        });
      } catch (err) {
        console.error(`Panel detection failed for page ${page}:`, err);
        this.processedPages++;
        this.pages.push({
          pageNumber: page,
          panelCount: 0,
          pageType: 'blank',
          processingTimeMs: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    if (!this.cancelled) {
      this.status = 'completed';
    }
  }
}

// Module-level singleton
export const jobManager = new JobManager();
