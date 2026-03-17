'use client';

import type { GDriveProgressState } from './useGDriveProgress';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface GDriveDownloadIndicatorProps {
  state: GDriveProgressState;
  onClick: () => void;
}

export function GDriveDownloadIndicator({ state, onClick }: GDriveDownloadIndicatorProps) {
  if (!state.jobId) return null;
  if (state.status === 'done' || state.status === 'cancelled' || state.status === 'error') return null;

  const totalBytes = state.files.reduce((sum, f) => sum + f.size, 0);
  const downloadedBytes = state.files.reduce((sum, f) => sum + f.bytesDownloaded, 0);
  const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-40 flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2.5 shadow-lg transition-all hover:bg-surface-elevated"
    >
      <div className="relative h-8 w-8">
        <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="14" fill="none" stroke="var(--accent)" strokeWidth="3"
            strokeDasharray={`${percent * 0.88} 88`}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
          {percent}%
        </span>
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-foreground truncate max-w-[140px]">{state.seriesName}</p>
        <p className="text-xs text-muted">
          {state.status === 'paused' ? 'Paused' : state.speed > 0 ? `${formatBytes(state.speed)}/s` : 'Downloading...'}
        </p>
      </div>
    </button>
  );
}
