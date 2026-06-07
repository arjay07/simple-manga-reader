'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVolumeProgress } from '@/components/Library/VolumeProgress';
import { VolumeGrid } from '@/components/Library/VolumeGrid';
import { ChapterList } from '@/components/Library/ChapterList';
import { CoverImage } from './CoverImage';
import { SeriesContinueButton } from './SeriesContinueButton';
import { SeriesProgressBar } from './SeriesProgressBar';
import { useAdmin } from '@/components/AdminProvider';
import { apiUrl } from '@/lib/basePath';
import { unitNoun } from '@/lib/unit-label';
import type { Series, Volume } from '@/types';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTitle, setSearchTitle] = useState(initialSeries.title);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

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

  async function runSearch(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSearching(true);
    setErrorMsg('');
    setCandidates([]);
    try {
      const res = await fetch(
        apiUrl(`/api/manga/${series.id}/metadata/search?title=${encodeURIComponent(trimmed)}`),
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Search failed');
      }
      const data = (await res.json()) as { candidates: MetadataCandidate[] };
      setCandidates(data.candidates);
      setSelectedIndex(0);
      if (data.candidates.length === 0) {
        setErrorMsg('No matches found on MangaDex for this title. Try editing it above.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reach MangaDex.');
    } finally {
      setSearching(false);
    }
  }

  function handleOpenModal() {
    setModalOpen(true);
    setSearchTitle(series.title);
    runSearch(series.title);
  }

  async function handleConfirm() {
    if (!selectedCandidate) return;
    setSaving(true);
    const candidate = selectedCandidate;
    try {
      const res = await fetch(apiUrl(`/api/manga/${series.id}/metadata`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: candidate.description,
          author: candidate.author,
          mangadexId: candidate.mangadexId,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = (await res.json()) as Series;
      setSeries(updated);
      handleDismiss();
      // Fire after modal close so progress appears on the page, not blocking the dismiss.
      if (candidate.mangadexId) {
        void runBulkCoverFetch(candidate.mangadexId, series.id, volumes);
      }
    } catch {
      setErrorMsg('Failed to save metadata. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function runBulkCoverFetch(_mangadexId: string, seriesId: number, vols: Volume[]) {
    // Chapter series have no per-unit MangaDex "volume" cover, so only the
    // whole-series cover is fetched; each chapter falls back to its page-1
    // thumbnail. Volume series additionally fetch a cover per volume.
    const fetchPerUnit = series.kind === 'volume';
    const total = fetchPerUnit ? 1 + vols.length : 1;
    let failures = 0;
    setBulkProgress({ done: 0, total });
    setBulkError(null);

    try {
      const res = await fetch(apiUrl(`/api/manga/${seriesId}/cover/generate-web`), {
        method: 'POST',
      });
      if (!res.ok) {
        failures += 1;
        console.error(`Series cover fetch failed: ${res.status}`);
      }
    } catch (err) {
      failures += 1;
      console.error('Series cover fetch error:', err);
    }
    setBulkProgress({ done: 1, total });

    if (!fetchPerUnit) {
      setBulkProgress(null);
      if (failures === total) {
        setBulkError('Cover fetch failed. MangaDex may be unreachable.');
        setTimeout(() => setBulkError(null), 8000);
      } else {
        router.refresh();
      }
      return;
    }

    for (let i = 0; i < vols.length; i++) {
      const vol = vols[i];
      if (i > 0) {
        // 250ms inter-request delay keeps us under MangaDex's ~5 req/sec rate limit.
        await new Promise((r) => setTimeout(r, 250));
      }
      try {
        const res = await fetch(
          apiUrl(`/api/manga/${seriesId}/${vol.id}/cover/generate-web`),
          { method: 'POST' },
        );
        if (!res.ok) {
          failures += 1;
          console.error(`Volume ${vol.id} cover fetch failed: ${res.status}`);
        }
      } catch (err) {
        failures += 1;
        console.error(`Volume ${vol.id} cover fetch error:`, err);
      }
      setBulkProgress({ done: 2 + i, total });
    }

    setBulkProgress(null);
    if (failures === total) {
      setBulkError('Cover fetch failed for all volumes. MangaDex may be unreachable.');
      setTimeout(() => setBulkError(null), 8000);
    } else {
      router.refresh();
    }
  }

  function handleDismiss() {
    setModalOpen(false);
    setCandidates([]);
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
          {series.author && <p className="mt-1 text-muted">{series.author}</p>}
          {series.description && (
            <p className="mt-3 text-sm text-foreground/80">{series.description}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            {volumes.length} {unitNoun(series.kind).toLowerCase()}
            {volumes.length === 1 ? '' : 's'}
          </p>

          {volumes.length > 0 && (
            <div className="mt-4 space-y-3">
              <SeriesContinueButton
                seriesId={series.id}
                kind={series.kind}
                volumes={volumes}
                progressMap={progressMap}
              />
              <SeriesProgressBar volumes={volumes} progressMap={progressMap} />
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleOpenModal}
                disabled={modalOpen}
                className="rounded-md bg-surface px-3 py-1.5 text-sm text-foreground border border-border hover:bg-border transition-colors disabled:opacity-50"
              >
                Fetch Metadata
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-surface px-3 py-1.5 text-sm text-red-500 border border-border hover:bg-border transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Series'}
              </button>
            </div>
          )}

          {bulkProgress && (
            <p className="mt-3 text-sm text-muted">
              Fetching covers… {bulkProgress.done}/{bulkProgress.total}
            </p>
          )}
          {bulkError && (
            <button
              onClick={() => setBulkError(null)}
              className="mt-3 block text-sm text-red-500 hover:underline"
              title="Click to dismiss"
            >
              {bulkError}
            </button>
          )}
        </div>
      </div>

      {/* Candidate selection modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-surface shadow-xl border border-border flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Search MangaDex</h2>
              <p className="mt-1 text-sm text-muted">
                Edit the title if it&apos;s wrong, then pick the matching entry.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(searchTitle);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  disabled={searching || saving}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
                  placeholder="Series title"
                />
                <button
                  type="submit"
                  disabled={searching || saving || !searchTitle.trim()}
                  className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </form>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {searching && candidates.length === 0 && (
                <p className="px-2 py-4 text-sm text-muted">Searching MangaDex…</p>
              )}
              {!searching && candidates.length === 0 && !errorMsg && (
                <p className="px-2 py-4 text-sm text-muted">No results yet.</p>
              )}
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
                  {c.author && <p className="text-xs text-muted mt-0.5">{c.author}</p>}
                  {c.description && (
                    <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{c.description}</p>
                  )}
                </button>
              ))}
            </div>

            {errorMsg && <p className="px-6 pb-2 text-sm text-red-500">{errorMsg}</p>}

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
                disabled={saving || !selectedCandidate}
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Metadata'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">{unitNoun(series.kind)}s</h2>
        {volumes.length === 0 ? (
          <p className="text-muted">
            No {unitNoun(series.kind).toLowerCase()}s found for this series.
          </p>
        ) : series.kind === 'chapter' ? (
          <ChapterList
            seriesId={series.id}
            kind={series.kind}
            volumes={volumes}
            progressMap={progressMap}
          />
        ) : (
          <VolumeGrid
            seriesId={series.id}
            kind={series.kind}
            mangadexId={series.mangadex_id}
            volumes={volumes}
            progressMap={progressMap}
          />
        )}
      </section>
    </>
  );
}
