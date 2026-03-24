'use client';

import { useEffect, useRef, useState } from 'react';
import { useGDriveProgress, type GDriveProgressState } from './useGDriveProgress';
import { apiUrl } from '@/lib/basePath';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

interface GDriveDownloadModalProps {
  open: boolean;
  onClose: () => void;
  onJobStarted: (jobId: string) => void;
  onComplete: () => void;
  jobId: string | null;
}

export function GDriveDownloadModal({ open, onClose, onJobStarted, onComplete, jobId }: GDriveDownloadModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { state } = useGDriveProgress(jobId);

  // Form state
  const [url, setUrl] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cancel confirmation
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isActive = jobId && state.status !== 'done' && state.status !== 'cancelled' && state.status !== 'error';
  const showForm = !jobId || state.status === 'done' || state.status === 'cancelled' || state.status === 'error';

  useEffect(() => {
    if (state.status === 'done') {
      onComplete();
    }
  }, [state.status, onComplete]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!url.trim()) {
      setFormError('Google Drive URL is required');
      return;
    }
    if (!seriesName.trim()) {
      setFormError('Series name is required');
      return;
    }
    if (!url.includes('drive.google.com')) {
      setFormError('Please enter a valid Google Drive URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/gdrive/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), seriesName: seriesName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to start download');
        return;
      }
      onJobStarted(data.jobId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePauseResume() {
    if (!jobId) return;
    const action = state.status === 'paused' ? 'resume' : 'pause';
    await fetch(apiUrl(`/api/gdrive/${action}/${jobId}`), { method: 'POST' });
  }

  async function handleCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    if (!jobId) return;
    await fetch(apiUrl(`/api/gdrive/cancel/${jobId}`), { method: 'POST' });
    setConfirmCancel(false);
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {showForm ? 'Add from Google Drive' : `Downloading: ${state.seriesName}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {showForm ? (
            <FormView
              url={url}
              setUrl={setUrl}
              seriesName={seriesName}
              setSeriesName={setSeriesName}
              formError={formError}
              submitting={submitting}
              onSubmit={handleSubmit}
              completedState={state.status === 'done' ? state : null}
            />
          ) : (
            <ProgressView
              state={state}
              onPauseResume={handlePauseResume}
              onCancel={handleCancel}
              confirmCancel={confirmCancel}
              setConfirmCancel={setConfirmCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Form View ---

function FormView({
  url, setUrl, seriesName, setSeriesName, formError, submitting, onSubmit, completedState,
}: {
  url: string;
  setUrl: (v: string) => void;
  seriesName: string;
  setSeriesName: (v: string) => void;
  formError: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  completedState: GDriveProgressState | null;
}) {
  return (
    <>
      {completedState && (
        <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          Download complete! {completedState.totalFiles} files downloaded ({formatBytes(completedState.totalBytes)}) in {formatDuration(completedState.elapsed)}.
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="gdrive-url" className="block text-sm font-medium text-foreground mb-1.5">
            Google Drive Folder URL
          </label>
          <input
            id="gdrive-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="series-name" className="block text-sm font-medium text-foreground mb-1.5">
            Series Name
          </label>
          <input
            id="series-name"
            type="text"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            placeholder="e.g. Dragon Ball"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        {formError && (
          <p className="text-sm text-red-500">{formError}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {submitting ? 'Starting...' : 'Start Download'}
        </button>
      </form>
    </>
  );
}

// --- Progress View ---

function ProgressView({
  state, onPauseResume, onCancel, confirmCancel, setConfirmCancel,
}: {
  state: GDriveProgressState;
  onPauseResume: () => void;
  onCancel: () => void;
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
}) {
  const completedFiles = state.files.filter(f => f.status === 'complete' || f.status === 'skipped').length;
  const totalFiles = state.files.length;
  const totalBytes = state.files.reduce((sum, f) => sum + f.size, 0);
  const downloadedBytes = state.files.reduce((sum, f) => sum + f.bytesDownloaded, 0);
  const overallPercent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-foreground font-medium">{overallPercent}%</span>
          <span className="text-muted">
            {completedFiles} of {totalFiles} files
            {state.speed > 0 && ` \u00b7 ${formatSpeed(state.speed)}`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* File List */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {state.files.map((file) => (
          <FileRow key={file.name} file={file} />
        ))}
      </div>

      {/* Controls */}
      {(state.status === 'downloading' || state.status === 'paused') && (
        <div className="flex gap-3">
          <button
            onClick={onPauseResume}
            className="flex-1 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-border transition-colors"
          >
            {state.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          {confirmCancel ? (
            <div className="flex flex-1 gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {state.status === 'paused' && (
        <p className="text-center text-sm text-muted">Download paused</p>
      )}
    </div>
  );
}

// --- File Row ---

function FileRow({ file }: { file: { name: string; size: number; status: string; bytesDownloaded: number; error?: string } }) {
  const percent = file.size > 0 ? Math.round((file.bytesDownloaded / file.size) * 100) : 0;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon status={file.status} />
          <span className="truncate text-sm text-foreground">{file.name}</span>
        </div>
        <span className="flex-shrink-0 text-xs text-muted">
          {file.status === 'queued' && '\u2014'}
          {file.status === 'downloading' && `${formatBytes(file.bytesDownloaded)} / ${formatBytes(file.size)}`}
          {file.status === 'complete' && formatBytes(file.size)}
          {file.status === 'skipped' && `${formatBytes(file.size)} skipped`}
          {file.status === 'error' && 'failed'}
        </span>
      </div>
      {file.status === 'downloading' && (
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {file.status === 'error' && file.error && (
        <p className="mt-1 text-xs text-red-500 truncate">{file.error}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-green-500">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === 'downloading') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-accent animate-pulse">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-red-500">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (status === 'skipped') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-muted">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  // queued
  return <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-border" />;
}
