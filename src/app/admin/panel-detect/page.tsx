'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/basePath';
import type {
  PanelDetectResponse,
  DetectionResult,
  Panel,
} from '@/lib/panel-detect/types';

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

export default function PanelDetectPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground p-6">Loading...</div>}>
      <PanelDetectPage />
    </Suspense>
  );
}

function PanelDetectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlSeries = searchParams.get('series') ?? '';
  const urlVolume = searchParams.get('volume') ?? '';
  const urlPage = Number(searchParams.get('page')) || 1;

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>(urlSeries);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>(urlVolume);
  const [pageNum, setPageNum] = useState(urlPage);
  const [maxPage, setMaxPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PanelDetectResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [confidence, setConfidence] = useState(0.25);
  const [showJson, setShowJson] = useState(false);
  const initFromUrl = useRef(!!urlVolume);
  const shouldAutoAnalyze = useRef(!!urlSeries && !!urlVolume);

  // Sync state to URL query params
  const updateUrl = useCallback((series: string, volume: string, page: number) => {
    const params = new URLSearchParams();
    if (series) params.set('series', series);
    if (volume) params.set('volume', volume);
    if (page > 1 || volume) params.set('page', String(page));
    const qs = params.toString();
    router.replace(`?${qs}`, { scroll: false });
  }, [router]);

  // Fetch series on mount
  useEffect(() => {
    fetch(apiUrl('/api/manga'))
      .then(r => r.json())
      .then(setSeriesList)
      .catch(() => setError('Failed to load series'));
  }, []);

  // Fetch volumes when series changes
  useEffect(() => {
    if (!selectedSeries) {
      setVolumes([]);
      setSelectedVolume('');
      return;
    }
    fetch(apiUrl(`/api/manga/${selectedSeries}`))
      .then(r => r.json())
      .then((data: SeriesDetail) => {
        const vols = data.volumes ?? [];
        setVolumes(vols);
        if (initFromUrl.current) {
          // Keep URL volume/page, clear the flag, and auto-analyze
          initFromUrl.current = false;
          if (shouldAutoAnalyze.current) {
            shouldAutoAnalyze.current = false;
            // Defer so state is settled
            setTimeout(() => analyzeRef.current?.(), 0);
          }
        } else {
          setSelectedVolume('');
          setPageNum(1);
          setResult(null);
        }
      })
      .catch(() => setError('Failed to load volumes'));
  }, [selectedSeries]);

  // Update max page when volume changes
  useEffect(() => {
    const vol = volumes.find(v => String(v.id) === selectedVolume);
    setMaxPage(vol?.page_count ?? null);
  }, [selectedVolume, volumes]);

  const analyzeRef = useRef<(overridePage?: number) => Promise<void>>(undefined);

  const analyze = useCallback(async (overridePage?: number) => {
    if (!selectedSeries || !selectedVolume) return;
    const pg = overridePage ?? pageNum;
    setLoading(true);
    setError(null);
    updateUrl(selectedSeries, selectedVolume, pg);
    try {
      const res = await fetch(apiUrl('/api/panel-detect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: selectedSeries,
          volumeId: selectedVolume,
          page: pg,
          confidenceThreshold: confidence,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Detection failed');
      }
      const data: PanelDetectResponse = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedSeries, selectedVolume, pageNum, confidence, updateUrl]);

  analyzeRef.current = analyze;

  const goPrev = () => {
    if (pageNum > 1) {
      const newPage = pageNum - 1;
      setPageNum(newPage);
      analyzeRef.current?.(newPage);
    }
  };

  const goNext = () => {
    if (!maxPage || pageNum < maxPage) {
      const newPage = pageNum + 1;
      setPageNum(newPage);
      analyzeRef.current?.(newPage);
    }
  };

  const copyJson = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result.results.ml, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mlResult = result?.results.ml;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Panel Detection Test</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Series</label>
          <select
            value={selectedSeries}
            onChange={e => { setSelectedSeries(e.target.value); updateUrl(e.target.value, '', 1); }}
            className="bg-surface border border-border rounded px-3 py-2 text-sm min-w-[200px]"
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
            onChange={e => { setSelectedVolume(e.target.value); updateUrl(selectedSeries, e.target.value, 1); }}
            disabled={volumes.length === 0}
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

        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Page</label>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={pageNum <= 1}
              className="bg-surface border border-border rounded px-2 py-2 text-sm disabled:opacity-30 hover:bg-surface-elevated"
            >
              &larr;
            </button>
            <input
              type="number"
              min={1}
              max={maxPage ?? undefined}
              value={pageNum}
              onChange={e => setPageNum(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-surface border border-border rounded px-3 py-2 text-sm w-20 text-center"
            />
            <button
              onClick={goNext}
              disabled={maxPage !== null && pageNum >= maxPage}
              className="bg-surface border border-border rounded px-2 py-2 text-sm disabled:opacity-30 hover:bg-surface-elevated"
            >
              &rarr;
            </button>
            {maxPage && (
              <span className="text-sm text-muted">/ {maxPage}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => analyze()}
          disabled={loading || !selectedSeries || !selectedVolume}
          className="bg-accent text-white rounded px-6 py-2 text-sm font-medium disabled:opacity-50 hover:bg-accent-hover transition-colors"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Confidence threshold slider */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-muted whitespace-nowrap">Confidence</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.05}
          value={confidence}
          onChange={e => setConfidence(parseFloat(e.target.value))}
          className="flex-1 max-w-[200px] accent-accent"
        />
        <span className="text-sm font-mono w-12 text-right">{confidence.toFixed(2)}</span>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {mlResult && result && (
        <>
          <div className="bg-surface border border-border rounded overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">ML / YOLO</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-muted">
                  {mlResult.pageType}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>{mlResult.panels.length} panels</span>
                <span>{mlResult.processingTimeMs}ms</span>
              </div>
            </div>
            <DetectionCanvas
              result={mlResult}
              pageImage={result.pageImage}
              imageWidth={result.imageWidth}
              imageHeight={result.imageHeight}
            />
          </div>

          {/* Panel details table */}
          {mlResult.panels.length > 0 && (
            <div className="bg-surface border border-border rounded overflow-hidden mb-6">
              <div className="px-4 py-2 border-b border-border">
                <span className="text-sm font-medium">Detected Panels</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Position (x, y)</th>
                      <th className="px-4 py-2">Size (w, h)</th>
                      <th className="px-4 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mlResult.panels.map((p: Panel) => (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="px-4 py-2 font-mono">{p.readingOrder}</td>
                        <td className="px-4 py-2 font-mono text-muted">{p.id}</td>
                        <td className="px-4 py-2 font-mono">{p.x.toFixed(3)}, {p.y.toFixed(3)}</td>
                        <td className="px-4 py-2 font-mono">{p.width.toFixed(3)}, {p.height.toFixed(3)}</td>
                        <td className="px-4 py-2">
                          <span className={`font-mono ${p.confidence >= 0.7 ? 'text-green-400' : p.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {p.confidence.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* JSON Output (collapsible) */}
          <div className="bg-surface border border-border rounded overflow-hidden">
            <button
              onClick={() => setShowJson(!showJson)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-surface-elevated transition-colors"
            >
              <span className="font-medium">JSON Output</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyJson(); }}
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <span className="text-muted">{showJson ? '▲' : '▼'}</span>
              </div>
            </button>
            {showJson && (
              <pre className="p-4 text-xs overflow-auto max-h-96 text-muted border-t border-border">
                {JSON.stringify(mlResult, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DetectionCanvas({
  result,
  pageImage,
  imageWidth,
  imageHeight,
}: {
  result: DetectionResult;
  pageImage: string;
  imageWidth: number;
  imageHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const img = new Image();
    img.onload = () => {
      const containerWidth = container.clientWidth;
      const scale = containerWidth / imageWidth;
      const displayHeight = imageHeight * scale;

      canvas.width = containerWidth;
      canvas.height = displayHeight;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, containerWidth, displayHeight);

      // Color scale: green (high conf) → yellow → red (low conf)
      const getColor = (conf: number) => {
        if (conf >= 0.7) return '#22c55e';
        if (conf >= 0.4) return '#eab308';
        return '#ef4444';
      };

      ctx.lineWidth = 3;
      ctx.font = 'bold 14px sans-serif';

      for (const panel of result.panels) {
        const x = panel.x * containerWidth;
        const y = panel.y * displayHeight;
        const w = panel.width * containerWidth;
        const h = panel.height * displayHeight;
        const color = getColor(panel.confidence);

        // Draw box with slight transparency fill
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = color + '15';
        ctx.fillRect(x, y, w, h);

        // Draw label: reading order + confidence
        const labelText = `${panel.readingOrder} (${panel.confidence.toFixed(2)})`;
        const textMetrics = ctx.measureText(labelText);
        const padding = 4;
        const labelW = textMetrics.width + padding * 2;
        const labelH = 20;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, labelW, labelH);
        ctx.fillStyle = '#000';
        ctx.fillText(labelText, x + padding, y + 15);
      }
    };
    img.src = `data:image/jpeg;base64,${pageImage}`;
  }, [result, pageImage, imageWidth, imageHeight]);

  return (
    <div ref={containerRef} className="relative">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}
