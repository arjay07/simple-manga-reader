'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { apiUrl } from '@/lib/basePath';
import { DetectionCanvas } from '@/components/DetectionCanvas';
import type { Panel, DetectionResult } from '@/lib/panel-detect/types';

interface Series {
  id: number;
  title: string;
  folder_name: string;
  volume_count: number;
}

interface Volume {
  id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  page_count: number | null;
}

interface SeriesDetail {
  id: number;
  title: string;
  volumes: Volume[];
}

interface PageSummary {
  pageNumber: number;
  panelCount: number;
  pageType: string;
  processingTimeMs: number;
  error?: string;
}

interface JobState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
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

interface PreviewData {
  pageNumber: number;
  panels: Panel[];
  readingTree: unknown;
  pageType: string;
  processingTimeMs: number | null;
  pageImage: string;
  imageWidth: number;
  imageHeight: number;
}

export default function PanelJobsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground p-6">Loading...</div>}>
      <PanelJobsPage />
    </Suspense>
  );
}

function PanelJobsPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState('');
  const [confidence, setConfidence] = useState(0.25);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch series on mount
  useEffect(() => {
    fetch(apiUrl('/api/manga'))
      .then(r => r.json())
      .then(setSeriesList)
      .catch(() => setError('Failed to load series'));
  }, []);

  // Fetch volumes when series changes
  useEffect(() => {
    if (!selectedSeries) { setVolumes([]); setSelectedVolume(''); return; }
    fetch(apiUrl(`/api/manga/${selectedSeries}`))
      .then(r => r.json())
      .then((data: SeriesDetail) => {
        setVolumes(data.volumes ?? []);
        setSelectedVolume('');
      })
      .catch(() => setError('Failed to load volumes'));
  }, [selectedSeries]);

  // Poll job status
  const pollJob = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/panel-jobs/current'));
      const data: JobState = await res.json();
      setJob(data);
      if (data.status !== 'running' && data.status !== 'paused') {
        stopPolling();
      }
    } catch {
      // ignore poll errors
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollJob, 2000);
    pollJob(); // immediate first poll
  }, [pollJob]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Check for active job on mount
  useEffect(() => {
    pollJob();
    return stopPolling;
  }, [pollJob]);

  // Start polling when job becomes active
  useEffect(() => {
    if (job?.status === 'running' || job?.status === 'paused') {
      if (!pollRef.current) startPolling();
    }
  }, [job?.status, startPolling]);

  const startJob = async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/panel-jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumeId: selectedVolume,
          confidenceThreshold: confidence,
          force,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to start job');
      }
      const data: JobState = await res.json();
      setJob(data);
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const pauseJob = async () => {
    const res = await fetch(apiUrl('/api/panel-jobs/current/pause'), { method: 'POST' });
    if (res.ok) setJob(await res.json());
  };

  const resumeJob = async () => {
    const res = await fetch(apiUrl('/api/panel-jobs/current/resume'), { method: 'POST' });
    if (res.ok) {
      setJob(await res.json());
      startPolling();
    }
  };

  const cancelJob = async () => {
    const res = await fetch(apiUrl('/api/panel-jobs/current/cancel'), { method: 'POST' });
    if (res.ok) setJob(await res.json());
  };

  // Preview modal
  const openPreview = (pageNum: number) => {
    setPreviewOpen(true);
    setPreviewPage(pageNum);
    loadPreviewPage(pageNum);
  };

  const loadPreviewPage = async (pageNum: number) => {
    if (!job?.volumeId) return;
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(apiUrl(`/api/panel-data/${job.volumeId}/${pageNum}`));
      if (res.ok) {
        setPreviewData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewNav = (delta: number) => {
    if (!job) return;
    const processedPageNumbers = job.pages.filter(p => !p.error).map(p => p.pageNumber);
    const idx = processedPageNumbers.indexOf(previewPage);
    const newIdx = idx + delta;
    if (newIdx >= 0 && newIdx < processedPageNumbers.length) {
      const newPage = processedPageNumbers[newIdx];
      setPreviewPage(newPage);
      loadPreviewPage(newPage);
    }
  };

  const isActive = job?.status === 'running' || job?.status === 'paused';
  const progressPercent = job && job.totalPages > 0
    ? Math.round((job.processedPages / job.totalPages) * 100)
    : 0;

  const elapsed = job?.startedAt ? (Date.now() - job.startedAt) / 1000 : 0;
  const remaining = job && job.pagesPerSecond > 0
    ? Math.round((job.totalPages - job.processedPages) / job.pagesPerSecond)
    : null;

  const processedPageNumbers = job?.pages.filter(p => !p.error).map(p => p.pageNumber) ?? [];
  const previewIdx = processedPageNumbers.indexOf(previewPage);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Panel Data Generation</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Series</label>
          <select
            value={selectedSeries}
            onChange={e => setSelectedSeries(e.target.value)}
            disabled={isActive}
            className="bg-surface border border-border rounded px-3 py-2 text-sm min-w-[200px] disabled:opacity-50"
          >
            <option value="">Select series...</option>
            {seriesList.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.volume_count} vol)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Volume</label>
          <select
            value={selectedVolume}
            onChange={e => setSelectedVolume(e.target.value)}
            disabled={volumes.length === 0 || isActive}
            className="bg-surface border border-border rounded px-3 py-2 text-sm min-w-[200px] disabled:opacity-50"
          >
            <option value="">Select volume...</option>
            {volumes.map(v => (
              <option key={v.id} value={v.id}>
                {v.title}{v.page_count ? ` (${v.page_count}p)` : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={startJob}
          disabled={!selectedVolume || isActive}
          className="bg-accent text-white rounded px-6 py-2 text-sm font-medium disabled:opacity-50 hover:bg-accent-hover transition-colors"
        >
          Generate
        </button>
      </div>

      {/* Confidence + Force */}
      <div className="flex flex-wrap items-center gap-6 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted whitespace-nowrap">Confidence</label>
          <input
            type="range"
            min={0.05} max={0.95} step={0.05}
            value={confidence}
            onChange={e => setConfidence(parseFloat(e.target.value))}
            disabled={isActive}
            className="flex-1 max-w-[200px] accent-accent"
          />
          <span className="text-sm font-mono w-12 text-right">{confidence.toFixed(2)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={force}
            onChange={e => setForce(e.target.checked)}
            disabled={isActive}
            className="accent-accent"
          />
          <span className="text-muted">Force re-generate (overwrite existing)</span>
        </label>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Job Progress */}
      {job && job.status !== 'idle' && (
        <div className="bg-surface border border-border rounded overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">
                {job.seriesTitle} &mdash; {job.volumeTitle}
              </span>
              <span className={`ml-3 text-xs px-2 py-0.5 rounded ${
                job.status === 'running' ? 'bg-green-900/40 text-green-400' :
                job.status === 'paused' ? 'bg-yellow-900/40 text-yellow-400' :
                job.status === 'completed' ? 'bg-blue-900/40 text-blue-400' :
                job.status === 'error' ? 'bg-red-900/40 text-red-400' :
                'bg-surface-elevated text-muted'
              }`}>
                {job.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {job.status === 'running' && (
                <button onClick={pauseJob} className="text-xs text-yellow-400 hover:text-yellow-300 px-3 py-1 border border-yellow-400/30 rounded">
                  Pause
                </button>
              )}
              {job.status === 'paused' && (
                <button onClick={resumeJob} className="text-xs text-green-400 hover:text-green-300 px-3 py-1 border border-green-400/30 rounded">
                  Resume
                </button>
              )}
              {isActive && (
                <button onClick={cancelJob} className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-400/30 rounded">
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-3">
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-surface-elevated rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-mono text-muted whitespace-nowrap">
                {job.processedPages}/{job.totalPages} ({progressPercent}%)
              </span>
            </div>

            {/* Stats line */}
            <div className="flex flex-wrap gap-4 text-xs text-muted">
              {job.status === 'running' && (
                <span>Page {job.currentPage}</span>
              )}
              {job.pagesPerSecond > 0 && (
                <span>{job.pagesPerSecond.toFixed(1)} pages/s</span>
              )}
              {remaining !== null && job.status === 'running' && (
                <span>ETA: {formatTime(remaining)}</span>
              )}
              {job.skippedPages > 0 && (
                <span>{job.skippedPages} skipped (already processed)</span>
              )}
              {job.pages.filter(p => p.error).length > 0 && (
                <span className="text-red-400">
                  {job.pages.filter(p => p.error).length} errors
                </span>
              )}
            </div>
          </div>

          {/* Completion summary */}
          {job.status === 'completed' && (
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-green-400 font-medium">Complete.</span>
                  {' '}{job.processedPages} pages processed
                  {job.skippedPages > 0 && ` (${job.skippedPages} skipped)`}
                  {elapsed > 0 && ` in ${formatTime(Math.round(elapsed))}`}
                </div>
                {processedPageNumbers.length > 0 && (
                  <button
                    onClick={() => openPreview(processedPageNumbers[0])}
                    className="text-sm text-accent hover:text-accent-hover"
                  >
                    View Processed Pages
                  </button>
                )}
              </div>
            </div>
          )}

          {job.status === 'error' && job.error && (
            <div className="px-4 py-3 border-t border-border text-sm text-red-400">
              Error: {job.error}
            </div>
          )}
        </div>
      )}

      {/* View processed pages button (when not active) */}
      {job && !isActive && job.status !== 'idle' && processedPageNumbers.length > 0 && job.status !== 'completed' && (
        <button
          onClick={() => openPreview(processedPageNumbers[0])}
          className="text-sm text-accent hover:text-accent-hover mb-6"
        >
          View Processed Pages ({processedPageNumbers.length})
        </button>
      )}

      {/* Also allow viewing during active job */}
      {isActive && processedPageNumbers.length > 0 && (
        <button
          onClick={() => openPreview(processedPageNumbers[processedPageNumbers.length - 1])}
          className="text-sm text-accent hover:text-accent-hover mb-6 block"
        >
          Preview Processed Pages ({processedPageNumbers.length})
        </button>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewOpen(false)}>
          <div
            className="bg-surface border border-border rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => previewNav(-1)}
                  disabled={previewIdx <= 0}
                  className="px-2 py-1 text-sm border border-border rounded disabled:opacity-30 hover:bg-surface-elevated"
                >
                  &larr;
                </button>
                <span className="text-sm font-mono">
                  Page {previewPage}
                  {processedPageNumbers.length > 0 && (
                    <span className="text-muted"> ({previewIdx + 1}/{processedPageNumbers.length})</span>
                  )}
                </span>
                <button
                  onClick={() => previewNav(1)}
                  disabled={previewIdx >= processedPageNumbers.length - 1}
                  className="px-2 py-1 text-sm border border-border rounded disabled:opacity-30 hover:bg-surface-elevated"
                >
                  &rarr;
                </button>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-sm text-muted hover:text-foreground px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              {previewLoading && (
                <div className="text-center py-12 text-muted text-sm">Loading page...</div>
              )}

              {previewData && !previewLoading && (
                <>
                  <DetectionCanvas
                    result={{
                      panels: previewData.panels,
                      readingTree: null,
                      pageType: previewData.pageType as 'panels' | 'cover' | 'full-bleed' | 'blank',
                      processingTimeMs: previewData.processingTimeMs ?? 0,
                      method: 'ml',
                    }}
                    pageImage={previewData.pageImage}
                    imageWidth={previewData.imageWidth}
                    imageHeight={previewData.imageHeight}
                  />
                  <div className="flex gap-4 text-xs text-muted mt-3">
                    <span className="px-2 py-0.5 bg-surface-elevated rounded">{previewData.pageType}</span>
                    <span>{previewData.panels.length} panels</span>
                    {previewData.processingTimeMs && (
                      <span>{previewData.processingTimeMs}ms</span>
                    )}
                  </div>
                </>
              )}

              {!previewData && !previewLoading && (
                <div className="text-center py-12 text-muted text-sm">No data for this page</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
