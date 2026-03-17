export type FileStatus = 'queued' | 'downloading' | 'complete' | 'error' | 'skipped';
export type JobStatus = 'listing' | 'downloading' | 'paused' | 'done' | 'cancelled' | 'error';

export interface FileInfo {
  id: string;          // Google Drive file ID
  name: string;
  size: number;        // bytes
  status: FileStatus;
  bytesDownloaded: number;
  error?: string;
}

export interface DownloadJob {
  id: string;
  url: string;
  seriesName: string;
  outputDir: string;
  status: JobStatus;
  files: FileInfo[];
  currentFileIndex: number;
  abortController: AbortController | null;
  startedAt: number;
  speed: number;       // bytes/sec
  listeners: Set<(event: DownloadEvent) => void>;
}

export type DownloadEvent =
  | { type: 'file-list'; files: Array<{ name: string; size: number; status: FileStatus }> }
  | { type: 'file-progress'; file: string; bytesDownloaded: number; totalBytes: number; speed: number }
  | { type: 'file-complete'; file: string; size: number }
  | { type: 'file-error'; file: string; message: string; retrying: boolean }
  | { type: 'file-skipped'; file: string; size: number }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'cancelled' }
  | { type: 'done'; totalFiles: number; totalBytes: number; elapsed: number }
  | { type: 'error'; message: string }
  | { type: 'state'; job: JobSnapshot };

export interface JobSnapshot {
  id: string;
  seriesName: string;
  status: JobStatus;
  files: Array<{ name: string; size: number; status: FileStatus; bytesDownloaded: number; error?: string }>;
  currentFileIndex: number;
  speed: number;
  startedAt: number;
}

export interface ManifestEntry {
  filename: string;
  md5: string;
  size: number;
  downloadedAt: string;
}

export type Manifest = Record<string, ManifestEntry>;
