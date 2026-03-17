import fs from 'fs';
import path from 'path';
import type { FileInfo } from './types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Extract a Google Drive folder ID from various URL formats.
 */
export function extractFolderId(url: string): string | null {
  // Format: https://drive.google.com/drive/folders/<id>
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // Format: https://drive.google.com/open?id=<id>
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

/**
 * List all PDF files in a Google Drive folder.
 * Handles pagination for folders with >100 files.
 */
export async function listFolderFiles(folderId: string, apiKey: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and (mimeType='application/pdf' or name contains '.pdf') and trashed=false`,
      key: apiKey,
      fields: 'nextPageToken,files(id,name,size,mimeType)',
      pageSize: '100',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${DRIVE_API_BASE}/files?${params}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${body}`);
    }

    const data = await res.json();
    for (const file of data.files ?? []) {
      // Double-check it's actually a PDF
      if (!file.name.toLowerCase().endsWith('.pdf') && file.mimeType !== 'application/pdf') {
        continue;
      }
      files.push({
        id: file.id,
        name: file.name,
        size: parseInt(file.size, 10) || 0,
        status: 'queued',
        bytesDownloaded: 0,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

interface DownloadFileOptions {
  signal?: AbortSignal;
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void;
  resumeFrom?: number; // byte offset to resume from
}

/**
 * Download a single file from Google Drive to disk.
 * Writes to <destPath>.part during download, renames on completion.
 * Supports resume via Range headers.
 */
export async function downloadFile(
  fileId: string,
  destPath: string,
  apiKey: string,
  options?: DownloadFileOptions
): Promise<void> {
  const partPath = destPath + '.part';
  const resumeFrom = options?.resumeFrom ?? 0;

  const headers: Record<string, string> = {};
  if (resumeFrom > 0) {
    headers['Range'] = `bytes=${resumeFrom}-`;
  }

  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media&key=${apiKey}`;
  const res = await fetch(url, {
    headers,
    signal: options?.signal,
  });

  if (!res.ok && res.status !== 206) {
    const body = await res.text();
    throw new Error(`Download failed (${res.status}): ${body}`);
  }

  if (!res.body) {
    throw new Error('No response body');
  }

  // Determine total size from content headers
  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
  const totalBytes = resumeFrom + contentLength;

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(partPath), { recursive: true });

  // Open file for writing (append if resuming)
  const flags = resumeFrom > 0 ? 'a' : 'w';
  const fileHandle = fs.openSync(partPath, flags);

  try {
    let bytesDownloaded = resumeFrom;
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fs.writeSync(fileHandle, value);
      bytesDownloaded += value.byteLength;
      options?.onProgress?.(bytesDownloaded, totalBytes);
    }
  } finally {
    fs.closeSync(fileHandle);
  }

  // Rename .part to final path
  fs.renameSync(partPath, destPath);
}
