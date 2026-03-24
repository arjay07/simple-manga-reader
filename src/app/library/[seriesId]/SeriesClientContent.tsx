'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVolumeProgress } from '@/components/Library/VolumeProgress';
import { VolumeGrid } from '@/components/Library/VolumeGrid';
import { CoverImage } from './CoverImage';
import { SeriesContinueButton } from './SeriesContinueButton';
import { SeriesProgressBar } from './SeriesProgressBar';
import { useAdmin } from '@/components/AdminProvider';
import { apiUrl } from '@/lib/basePath';

interface Volume {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  page_count: number | null;
}

interface Series {
  id: number;
  title: string;
  folder_name: string;
  cover_path: string | null;
  author: string | null;
  description: string | null;
  mangadex_id: string | null;
}

interface MetadataCandidate {
  mangadexId: string;
  title: string;
  description: string;
  author: string;
}

export function SeriesClientContent({
  series: initialSeries,
  volumes,
}: {
  series: Series;
  volumes: Volume[];
}) {
  const progressMap = useVolumeProgress();
  const { isAdmin } = useAdmin();
  const router = useRouter();

  const [series, setSeries] = useState(initialSeries);
  const [deleting, setDeleting] = useState(false);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const selectedCandidate = candidates[selectedIndex] ?? null;

  async function handleDelete() {
    if (!confirm(`Delete "${series.title}" from the library?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/manga/${series.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/library');
    } catch {
      setDeleting(false);
    }
  }

  async function handleFetchMetadata() {
    setFetchState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(apiUrl(`/api/manga/${series.id}/metadata/search`));
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Search failed');
      }
      const data = await res.json() as { candidates: MetadataCandidate[] };
      if (data.candidates.length === 0) {
        setFetchState('error');
        setErrorMsg('No matches found on MangaDex for this series title.');
        return;
      }
      setCandidates(data.candidates);
      setSelectedIndex(0);
      setFetchState('idle');
    } catch (err) {
      setFetchState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reach MangaDex.');
    }
  }

  async function handleConfirm() {
    if (!selectedCandidate) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/manga/${series.id}/metadata`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: selectedCandidate.description,
          author: selectedCandidate.author,
          mangadexId: selectedCandidate.mangadexId,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json() as Series;
      setSeries(updated);
      setCandidates([]);
    } catch {
      setErrorMsg('Failed to save metadata. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    setCandidates([]);
    setFetchState('idle');
    setErrorMsg('');
  }

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full max-w-[240px] shrink-0">
          <CoverImage series={series} />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{series.title}</h1>
          {series.author && (
            <p className="mt-1 text-muted">{series.author}</p>
          )}
          {series.description && (
            <p className="mt-3 text-sm text-foreground/80">{series.description}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            {volumes.length} {volumes.length === 1 ? 'volume' : 'volumes'}
          </p>

          {volumes.length > 0 && (
            <div className="mt-4 space-y-3">
              <SeriesContinueButton
                seriesId={series.id}
                volumes={volumes}
                progressMap={progressMap}
              />
              <SeriesProgressBar
                volumes={volumes}
                progressMap={progressMap}
              />
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleFetchMetadata}
                disabled={fetchState === 'loading'}
                className="rounded-md bg-surface px-3 py-1.5 text-sm text-foreground border border-border hover:bg-border transition-colors disabled:opacity-50"
              >
                {fetchState === 'loading' ? 'Searching…' : 'Fetch Metadata'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-surface px-3 py-1.5 text-sm text-red-500 border border-border hover:bg-border transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Series'}
              </button>
              {fetchState === 'error' && (
                <p className="text-sm text-red-500">{errorMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Candidate selection modal */}
      {candidates.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-surface shadow-xl border border-border flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Select a Match</h2>
              <p className="mt-1 text-sm text-muted">
                {candidates.length} result{candidates.length !== 1 ? 's' : ''} from MangaDex — pick the correct one.
              </p>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {candidates.map((c, i) => (
                <button
                  key={c.mangadexId}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    i === selectedIndex
                      ? 'border-foreground bg-background'
                      : 'border-border hover:border-muted'
                  }`}
                >
                  <p className="font-medium text-foreground text-sm">{c.title}</p>
                  {c.author && (
                    <p className="text-xs text-muted mt-0.5">{c.author}</p>
                  )}
                  {c.description && (
                    <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{c.description}</p>
                  )}
                </button>
              ))}
            </div>

            {errorMsg && (
              <p className="px-6 pb-2 text-sm text-red-500">{errorMsg}</p>
            )}

            <div className="p-6 pt-4 border-t border-border shrink-0 flex justify-end gap-3">
              <button
                onClick={handleDismiss}
                disabled={saving}
                className="rounded-md px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Metadata'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Volumes</h2>
        {volumes.length === 0 ? (
          <p className="text-muted">No volumes found for this series.</p>
        ) : (
          <VolumeGrid seriesId={series.id} volumes={volumes} progressMap={progressMap} />
        )}
      </section>
    </>
  );
}
