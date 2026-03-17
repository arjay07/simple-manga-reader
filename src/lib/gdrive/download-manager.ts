import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getMangaDir } from '../settings';
import { scanMangaDirectory } from '../scanner';
import { extractFolderId, listFolderFiles, downloadFile } from './google-api';
import type { DownloadJob, DownloadEvent, FileInfo, JobSnapshot, Manifest } from './types';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 3000;

function generateJobId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function fileMd5(filepath: string): string {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filepath);
  hash.update(data);
  return hash.digest('hex');
}

function loadManifest(manifestPath: string): Manifest {
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }
  return {};
}

function saveManifest(manifest: Manifest, manifestPath: string): void {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

class DownloadManager {
  private jobs = new Map<string, DownloadJob>();

  getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId);
  }

  getActiveJob(): DownloadJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.status === 'listing' || job.status === 'downloading' || job.status === 'paused') {
        return job;
      }
    }
    return undefined;
  }

  getJobSnapshot(job: DownloadJob): JobSnapshot {
    return {
      id: job.id,
      seriesName: job.seriesName,
      status: job.status,
      files: job.files.map(f => ({
        name: f.name,
        size: f.size,
        status: f.status,
        bytesDownloaded: f.bytesDownloaded,
        error: f.error,
      })),
      currentFileIndex: job.currentFileIndex,
      speed: job.speed,
      startedAt: job.startedAt,
    };
  }

  // --- SSE Listener Management ---

  addListener(jobId: string, callback: (event: DownloadEvent) => void): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.listeners.add(callback);
    }
  }

  removeListener(jobId: string, callback: (event: DownloadEvent) => void): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.listeners.delete(callback);
    }
  }

  private emit(job: DownloadJob, event: DownloadEvent): void {
    for (const listener of job.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors (e.g., closed connections)
      }
    }
  }

  // --- Job Lifecycle ---

  async startJob(url: string, seriesName: string): Promise<{ jobId: string; files: FileInfo[] }> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is not configured');
    }

    if (this.getActiveJob()) {
      throw new Error('A download is already in progress');
    }

    const folderId = extractFolderId(url);
    if (!folderId) {
      throw new Error('Invalid Google Drive folder URL');
    }

    const mangaDir = getMangaDir();
    const outputDir = path.join(mangaDir, seriesName);
    const manifestPath = path.join(outputDir, '.download_manifest.json');

    fs.mkdirSync(outputDir, { recursive: true });

    const jobId = generateJobId();
    const job: DownloadJob = {
      id: jobId,
      url,
      seriesName,
      outputDir,
      status: 'listing',
      files: [],
      currentFileIndex: 0,
      abortController: null,
      startedAt: Date.now(),
      speed: 0,
      listeners: new Set(),
    };
    this.jobs.set(jobId, job);

    // List files from Google Drive
    let files: FileInfo[];
    try {
      files = await listFolderFiles(folderId, apiKey);
    } catch (err) {
      job.status = 'error';
      this.jobs.delete(jobId);
      throw err;
    }

    if (files.length === 0) {
      this.jobs.delete(jobId);
      throw new Error('No PDF files found in the Google Drive folder');
    }

    // Check manifest for already-downloaded files
    const manifest = loadManifest(manifestPath);
    for (const file of files) {
      const destPath = path.join(outputDir, file.name);
      if (manifest[file.name] && fs.existsSync(destPath)) {
        const existingSize = fs.statSync(destPath).size;
        if (existingSize === file.size || file.size === 0) {
          file.status = 'skipped';
          file.bytesDownloaded = existingSize;
        }
      }
    }

    job.files = files;
    job.status = 'downloading';

    // Emit file list
    this.emit(job, {
      type: 'file-list',
      files: files.map(f => ({ name: f.name, size: f.size, status: f.status })),
    });

    // Emit skipped files
    for (const file of files) {
      if (file.status === 'skipped') {
        this.emit(job, { type: 'file-skipped', file: file.name, size: file.size });
      }
    }

    // Start download loop (non-blocking)
    this.downloadLoop(job).catch(err => {
      console.error('Download loop error:', err);
      job.status = 'error';
      this.emit(job, { type: 'error', message: err.message });
    });

    return { jobId, files };
  }

  pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'downloading') throw new Error('Job is not downloading');

    job.status = 'paused';
    job.abortController?.abort();
    job.abortController = null;
    this.emit(job, { type: 'paused' });
  }

  resumeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'paused') throw new Error('Job is not paused');

    job.status = 'downloading';
    this.emit(job, { type: 'resumed' });

    // Restart download loop from current file
    this.downloadLoop(job).catch(err => {
      console.error('Download loop error:', err);
      job.status = 'error';
      this.emit(job, { type: 'error', message: err.message });
    });
  }

  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'cancelled';
    job.abortController?.abort();
    job.abortController = null;

    // Clean up .part files
    for (const file of job.files) {
      const partPath = path.join(job.outputDir, file.name + '.part');
      if (fs.existsSync(partPath)) {
        fs.unlinkSync(partPath);
      }
    }

    this.emit(job, { type: 'cancelled' });

    // Rescan if any files completed
    const hasCompleted = job.files.some(f => f.status === 'complete');
    if (hasCompleted) {
      try {
        scanMangaDirectory();
      } catch (err) {
        console.error('Rescan failed after cancel:', err);
      }
    }

    this.jobs.delete(jobId);
  }

  // --- Download Loop ---

  private async downloadLoop(job: DownloadJob): Promise<void> {
    const apiKey = process.env.GOOGLE_API_KEY!;
    const manifestPath = path.join(job.outputDir, '.download_manifest.json');
    const manifest = loadManifest(manifestPath);

    for (let i = job.currentFileIndex; i < job.files.length; i++) {
      if (job.status !== 'downloading') return;

      const file = job.files[i];
      job.currentFileIndex = i;

      if (file.status === 'skipped' || file.status === 'complete') continue;

      const destPath = path.join(job.outputDir, file.name);
      const partPath = destPath + '.part';

      // Check if we can resume from a .part file
      let resumeFrom = 0;
      if (fs.existsSync(partPath)) {
        resumeFrom = fs.statSync(partPath).size;
        file.bytesDownloaded = resumeFrom;
      }

      file.status = 'downloading';

      let success = false;
      let lastError: Error | null = null;
      let delay = BASE_RETRY_DELAY;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (job.status !== 'downloading') return;

        const abortController = new AbortController();
        job.abortController = abortController;

        let lastProgressTime = Date.now();
        let lastProgressBytes = resumeFrom;

        try {
          await downloadFile(file.id, destPath, apiKey, {
            signal: abortController.signal,
            resumeFrom,
            onProgress: (bytesDownloaded, totalBytes) => {
              file.bytesDownloaded = bytesDownloaded;

              // Calculate speed
              const now = Date.now();
              const elapsed = (now - lastProgressTime) / 1000;
              if (elapsed >= 0.5) {
                const byteDelta = bytesDownloaded - lastProgressBytes;
                job.speed = Math.round(byteDelta / elapsed);
                lastProgressTime = now;
                lastProgressBytes = bytesDownloaded;
              }

              this.emit(job, {
                type: 'file-progress',
                file: file.name,
                bytesDownloaded,
                totalBytes,
                speed: job.speed,
              });
            },
          });

          success = true;
          break;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            // Pause or cancel — don't retry
            return;
          }

          lastError = err instanceof Error ? err : new Error(String(err));
          const isRateLimit = lastError.message.includes('429') || lastError.message.includes('403');

          if (!isRateLimit || attempt === MAX_RETRIES) {
            this.emit(job, {
              type: 'file-error',
              file: file.name,
              message: lastError.message,
              retrying: false,
            });
            break;
          }

          this.emit(job, {
            type: 'file-error',
            file: file.name,
            message: `Rate limited, retrying in ${delay / 1000}s...`,
            retrying: true,
          });

          // Wait with ability to be cancelled
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, delay);
            // If job gets cancelled during wait, resolve immediately
            const checkInterval = setInterval(() => {
              if (job.status !== 'downloading') {
                clearTimeout(timer);
                clearInterval(checkInterval);
                resolve();
              }
            }, 200);
            setTimeout(() => clearInterval(checkInterval), delay + 100);
          });

          delay *= 2;

          // Update resume offset for retry (we may have gotten some bytes)
          if (fs.existsSync(partPath)) {
            resumeFrom = fs.statSync(partPath).size;
          }
        }
      }

      if (success) {
        file.status = 'complete';
        file.bytesDownloaded = file.size || (fs.existsSync(destPath) ? fs.statSync(destPath).size : 0);

        // Update manifest
        const md5 = fileMd5(destPath);
        manifest[file.name] = {
          filename: file.name,
          md5,
          size: file.bytesDownloaded,
          downloadedAt: new Date().toISOString(),
        };
        saveManifest(manifest, manifestPath);

        this.emit(job, { type: 'file-complete', file: file.name, size: file.bytesDownloaded });
      } else {
        file.status = 'error';
        file.error = lastError?.message ?? 'Unknown error';
      }
    }

    // All files processed
    if (job.status === 'downloading') {
      job.status = 'done';
      const totalBytes = job.files.reduce((sum, f) => sum + f.bytesDownloaded, 0);
      const elapsed = Date.now() - job.startedAt;

      this.emit(job, {
        type: 'done',
        totalFiles: job.files.filter(f => f.status === 'complete').length,
        totalBytes,
        elapsed,
      });

      // Auto-rescan
      try {
        scanMangaDirectory();
      } catch (err) {
        console.error('Rescan failed after download:', err);
      }
    }
  }
}

// Singleton
const downloadManager = new DownloadManager();
export { downloadManager };
