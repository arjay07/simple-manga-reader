'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export type FileStatus = 'queued' | 'downloading' | 'complete' | 'error' | 'skipped';
export type JobStatus = 'listing' | 'downloading' | 'paused' | 'done' | 'cancelled' | 'error';

export interface FileState {
  name: string;
  size: number;
  status: FileStatus;
  bytesDownloaded: number;
  error?: string;
}

export interface GDriveProgressState {
  connected: boolean;
  jobId: string | null;
  seriesName: string;
  status: JobStatus;
  files: FileState[];
  currentFileIndex: number;
  speed: number;
  startedAt: number;
  totalFiles: number;
  totalBytes: number;
  elapsed: number;
}

const initialState: GDriveProgressState = {
  connected: false,
  jobId: null,
  seriesName: '',
  status: 'listing',
  files: [],
  currentFileIndex: 0,
  speed: 0,
  startedAt: 0,
  totalFiles: 0,
  totalBytes: 0,
  elapsed: 0,
};

export function useGDriveProgress(jobId: string | null) {
  const [state, setState] = useState<GDriveProgressState>(initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, connected: false }));
  }, []);

  useEffect(() => {
    if (!jobId) {
      disconnect();
      setState(initialState);
      return;
    }

    const es = new EventSource(`/api/gdrive/progress/${jobId}`);
    eventSourceRef.current = es;

    es.addEventListener('state', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        connected: true,
        jobId,
        seriesName: data.seriesName,
        status: data.status,
        files: data.files,
        currentFileIndex: data.currentFileIndex,
        speed: data.speed,
        startedAt: data.startedAt,
      }));
    });

    es.addEventListener('file-list', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        files: data.files.map((f: { name: string; size: number; status: FileStatus }) => ({
          ...f,
          bytesDownloaded: 0,
        })),
      }));
    });

    es.addEventListener('file-progress', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        speed: data.speed,
        files: prev.files.map(f =>
          f.name === data.file
            ? { ...f, status: 'downloading' as const, bytesDownloaded: data.bytesDownloaded, size: data.totalBytes || f.size }
            : f
        ),
      }));
    });

    es.addEventListener('file-complete', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.name === data.file
            ? { ...f, status: 'complete' as const, bytesDownloaded: data.size, size: data.size }
            : f
        ),
      }));
    });

    es.addEventListener('file-error', (e) => {
      const data = JSON.parse(e.data);
      if (!data.retrying) {
        setState(prev => ({
          ...prev,
          files: prev.files.map(f =>
            f.name === data.file
              ? { ...f, status: 'error' as const, error: data.message }
              : f
          ),
        }));
      }
    });

    es.addEventListener('file-skipped', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.name === data.file
            ? { ...f, status: 'skipped' as const, bytesDownloaded: data.size, size: data.size }
            : f
        ),
      }));
    });

    es.addEventListener('paused', () => {
      setState(prev => ({ ...prev, status: 'paused', speed: 0 }));
    });

    es.addEventListener('resumed', () => {
      setState(prev => ({ ...prev, status: 'downloading' }));
    });

    es.addEventListener('cancelled', () => {
      setState(prev => ({ ...prev, status: 'cancelled', speed: 0 }));
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        status: 'done',
        speed: 0,
        totalFiles: data.totalFiles,
        totalBytes: data.totalBytes,
        elapsed: data.elapsed,
      }));
    });

    es.addEventListener('error', (e) => {
      // SSE connection error vs server-sent error event
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setState(prev => ({ ...prev, status: 'error', speed: 0 }));
        console.error('GDrive download error:', data.message);
      }
    });

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }));
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [jobId, disconnect]);

  return { state, disconnect };
}
