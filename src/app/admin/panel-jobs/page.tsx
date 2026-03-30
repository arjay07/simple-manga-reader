'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { apiUrl } from '@/lib/basePath';
import { DetectionCanvas } from '@/components/DetectionCanvas';
import type { Panel } from '@/lib/panel-detect/types';

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

interface PanelDataStatus {
  totalPages: number;
  processedPages: number;
  isComplete: boolean;
}

interface QueueItemState {
  id: number;
  volumeId: number;
  volumeTitle: string;
  sortOrder: number;
  status: string;
  totalPages: number;
  processedPages: number;
  currentPage: number;
  error?: string;
}

interface JobState {
  status: string;
  totalPages: number;
  processedPages: number;
  skippedPages: number;
  currentPage: number;
  pagesPerSecond: number;
  pages: Array<{
    pageNumber: number;
    panelCount: number;
    pageType: string;
    processingTimeMs: number;
    error?: string;
  }>;
}

interface QueueState {
  status: string;
  queueId?: number;
  seriesId?: number;
  seriesTitle?: string;
  confidenceThreshold: number;
  force: boolean;
  items: QueueItemState[];
  totalVolumes: number;
  completedVolumes: number;
  currentVolume?: QueueItemState;
  currentJobState?: JobState;
  startedAt?: number;
  createdAt?: string;
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
  const [checkedVolumes, setCheckedVolumes] = useState<Set<number>>(new Set());
  const [panelStatus, setPanelStatus] = useState<Record<number, PanelDataStatus>>({});
  const [confidence, setConfidence] = useState(0.25);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewVolumeId, setPreviewVolumeId] = useState<number | null>(null);
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

  // Fetch volumes + panel data status when series changes
  useEffect(() => {
    if (!selectedSeries) {
      setVolumes([]);
      setCheckedVolumes(new Set());
      setPanelStatus({});
      return;
    }

    Promise.all([
      fetch(apiUrl(`/api/manga/${selectedSeries}`)).then(r => r.json()),
      fetch(apiUrl(`/api/panel-queue/series-status?seriesId=${selectedSeries}`)).then(r => r.json()),
    ]).then(([seriesData, statusData]: [SeriesDetail, Record<number, PanelDataStatus>]) => {
      setVolumes(seriesData.volumes ?? []);
      setPanelStatus(statusData);
      setCheckedVolumes(new Set());
    }).catch(() => setError('Failed to load volumes'));
  }, [selectedSeries]);

  // Poll queue status
  const pollQueue = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/panel-queue/current'));
      const data: QueueState = await res.json();
      setQueue(data);
      if (data.status !== 'running' && data.status !== 'paused') {
        stopPolling();
      }
    } catch {
      // ignore poll errors
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollQueue, 2000);
    pollQueue();
  }, [pollQueue]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Check for active queue on mount
  useEffect(() => {
    pollQueue();
    return stopPolling;
  }, [pollQueue]);

  // Start polling when queue becomes active
  useEffect(() => {
    if (queue?.status === 'running' || queue?.status === 'paused') {
      if (!pollRef.current) startPolling();
    }
  }, [queue?.status, startPolling]);

  // Volume checkbox handlers
  const toggleVolume = (volumeId: number) => {
    setCheckedVolumes(prev => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  };

  const selectAll = () => setCheckedVolumes(new Set(volumes.map(v => v.id)));
  const selectNone = () => setCheckedVolumes(new Set());
  const allSelected = volumes.length > 0 && checkedVolumes.size === volumes.length;

  const startQueue = async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/panel-queue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: Number(selectedSeries),
          volumeIds: Array.from(checkedVolumes),
          confidenceThreshold: confidence,
          force,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to start queue');
      }
      const data: QueueState = await res.json();
      setQueue(data);
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const pauseQueue = async () => {
    const res = await fetch(apiUrl('/api/panel-queue/pause'), { method: 'POST' });
    if (res.ok) setQueue(await res.json());
  };

  const resumeQueue = async () => {
    const res = await fetch(apiUrl('/api/panel-queue/resume'), { method: 'POST' });
    if (res.ok) {
      setQueue(await res.json());
      startPolling();
    }
  };

  const cancelQueue = async () => {
    const res = await fetch(apiUrl('/api/panel-queue/cancel'), { method: 'POST' });
    if (res.ok) setQueue(await res.json());
  };

  // Preview modal
  const openPreview = (volumeId: number, pageNum: number) => {
    setPreviewOpen(true);
    setPreviewVolumeId(volumeId);
    setPreviewPage(pageNum);
    loadPreviewPage(volumeId, pageNum);
  };

  const loadPreviewPage = async (volumeId: number, pageNum: number) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(apiUrl(`/api/panel-data/${volumeId}/${pageNum}`));
      if (res.ok) {
        setPreviewData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  const isActive = queue?.status === 'running' || queue?.status === 'paused';

  // Compute progress
  const jobState = queue?.currentJobState;
  const overallProgress = queue && queue.totalVolumes > 0
    ? Math.round((queue.completedVolumes / queue.totalVolumes) * 100)
    : 0;

  const currentItemProgress = jobState && jobState.totalPages > 0
    ? Math.round((jobState.processedPages / jobState.totalPages) * 100)
    : 0;

  const elapsed = queue?.startedAt ? (Date.now() - queue.startedAt) / 1000 : 0;

  // ETA: estimate based on current volume speed and remaining volumes
  const totalPagesRemaining = queue?.items
    .filter(i => i.status === 'pending' || i.status === 'running')
    .reduce((sum, i) => {
      if (i.status === 'running' && jobState) {
        return sum + (jobState.totalPages - jobState.processedPages);
      }
      return sum + i.totalPages;
    }, 0) ?? 0;

  const eta = jobState && jobState.pagesPerSecond > 0
    ? Math.round(totalPagesRemaining / jobState.pagesPerSecond)
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Panel Data Generation</h1>

      {/* Series Selector */}
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
      </div>

      {/* Volume Checkboxes */}
      {volumes.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm text-muted">Volumes</label>
            <button
              onClick={allSelected ? selectNone : selectAll}
              disabled={isActive}
              className="text-xs text-accent hover:text-accent-hover disabled:opacity-50"
            >
              {allSelected ? 'Select None' : 'Select All'}
            </button>
          </div>
          <div className="bg-surface border border-border rounded divide-y divide-border max-h-[300px] overflow-y-auto">
            {volumes.map(v => {
              const status = panelStatus[v.id];
              const hasData = status && status.processedPages > 0;
              const isComplete = status?.isComplete;

              return (
                <label
                  key={v.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-surface-elevated transition-colors ${isActive ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checkedVolumes.has(v.id)}
                    onChange={() => toggleVolume(v.id)}
                    disabled={isActive}
                    className="accent-accent"
                  />
                  <span className="flex-1">{v.title}</span>
                  {v.page_count && (
                    <span className="text-xs text-muted">{v.page_count}p</span>
                  )}
                  {isComplete && (
                    <span className="text-xs text-green-400" title="Panel data complete">&#10003;</span>
                  )}
                  {hasData && !isComplete && (
                    <span className="text-xs text-yellow-400" title={`${status.processedPages}/${status.totalPages} pages`}>
                      partial
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidence + Force */}
      <div className="flex flex-wrap items-center gap-6 mb-4">
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

      {/* Generate Button */}
      <button
        onClick={startQueue}
        disabled={checkedVolumes.size === 0 || isActive}
        className="bg-accent text-white rounded px-6 py-2 text-sm font-medium disabled:opacity-50 hover:bg-accent-hover transition-colors mb-6"
      >
        Generate Selected ({checkedVolumes.size})
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Queue Progress */}
      {queue && queue.status !== 'pending' && queue.queueId && (
        <div className="bg-surface border border-border rounded overflow-hidden mb-6">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">
                {queue.seriesTitle}
              </span>
              <span className={`ml-3 text-xs px-2 py-0.5 rounded ${
                queue.status === 'running' ? 'bg-green-900/40 text-green-400' :
                queue.status === 'paused' ? 'bg-yellow-900/40 text-yellow-400' :
                queue.status === 'completed' ? 'bg-blue-900/40 text-blue-400' :
                queue.status === 'cancelled' ? 'bg-orange-900/40 text-orange-400' :
                queue.status === 'error' ? 'bg-red-900/40 text-red-400' :
                'bg-surface-elevated text-muted'
              }`}>
                {queue.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {queue.status === 'running' && (
                <button onClick={pauseQueue} className="text-xs text-yellow-400 hover:text-yellow-300 px-3 py-1 border border-yellow-400/30 rounded">
                  Pause
                </button>
              )}
              {queue.status === 'paused' && (
                <button onClick={resumeQueue} className="text-xs text-green-400 hover:text-green-300 px-3 py-1 border border-green-400/30 rounded">
                  Resume
                </button>
              )}
              {isActive && (
                <button onClick={cancelQueue} className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-400/30 rounded">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Overall progress */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-surface-elevated rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-sm font-mono text-muted whitespace-nowrap">
                {queue.completedVolumes}/{queue.totalVolumes} volumes ({overallProgress}%)
              </span>
            </div>

            {/* Current volume progress */}
            {jobState && queue.status === 'running' && (
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-surface-elevated rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${currentItemProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted whitespace-nowrap">
                  Page {jobState.currentPage}/{jobState.totalPages}
                </span>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-xs text-muted">
              {jobState && jobState.pagesPerSecond > 0 && (
                <span>{jobState.pagesPerSecond.toFixed(1)} pages/s</span>
              )}
              {eta !== null && queue.status === 'running' && (
                <span>ETA: {formatTime(eta)}</span>
              )}
              {elapsed > 0 && queue.status === 'running' && (
                <span>Elapsed: {formatTime(Math.round(elapsed))}</span>
              )}
            </div>
          </div>

          {/* Per-item list */}
          <div className="border-t border-border divide-y divide-border">
            {queue.items.map(item => (
              <div key={item.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  item.status === 'completed' ? 'bg-green-400' :
                  item.status === 'running' ? 'bg-accent animate-pulse' :
                  item.status === 'error' ? 'bg-red-400' :
                  item.status === 'skipped' || item.status === 'cancelled' ? 'bg-orange-400' :
                  item.status === 'paused' ? 'bg-yellow-400' :
                  'bg-surface-elevated'
                }`} />
                <span className="flex-1">{item.volumeTitle}</span>
                <span className="text-xs text-muted">
                  {item.status === 'running' && jobState
                    ? `${jobState.processedPages}/${jobState.totalPages}p`
                    : item.status === 'completed'
                    ? `${item.processedPages}/${item.totalPages}p`
                    : item.status}
                </span>
                {item.error && (
                  <span className="text-xs text-red-400" title={item.error}>error</span>
                )}
              </div>
            ))}
          </div>

          {/* Completion summary */}
          {queue.status === 'completed' && (
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-green-400 font-medium">Complete.</span>
                  {' '}{queue.completedVolumes} volumes processed
                  {elapsed > 0 && ` in ${formatTime(Math.round(elapsed))}`}
                </div>
                {queue.items.some(i => i.status === 'completed') && (
                  <button
                    onClick={() => {
                      const first = queue.items.find(i => i.status === 'completed');
                      if (first) openPreview(first.volumeId, 1);
                    }}
                    className="text-sm text-accent hover:text-accent-hover"
                  >
                    View Processed Pages
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewOpen && previewVolumeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewOpen(false)}>
          <div
            className="bg-surface border border-border rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const prev = previewPage - 1;
                    if (prev >= 1) {
                      setPreviewPage(prev);
                      loadPreviewPage(previewVolumeId, prev);
                    }
                  }}
                  disabled={previewPage <= 1}
                  className="px-2 py-1 text-sm border border-border rounded disabled:opacity-30 hover:bg-surface-elevated"
                >
                  &larr;
                </button>
                <span className="text-sm font-mono">Page {previewPage}</span>
                <button
                  onClick={() => {
                    const next = previewPage + 1;
                    setPreviewPage(next);
                    loadPreviewPage(previewVolumeId, next);
                  }}
                  className="px-2 py-1 text-sm border border-border rounded hover:bg-surface-elevated"
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
