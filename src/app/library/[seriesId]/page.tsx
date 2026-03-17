import { getDb } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HeaderMenu } from '@/components/HeaderMenu';
import { CoverImage } from './CoverImage';
import { VolumeGrid } from '@/components/Library/VolumeGrid';

interface Series {
  id: number;
  title: string;
  folder_name: string;
  cover_path: string | null;
  author: string | null;
  description: string | null;
}

interface Volume {
  id: number;
  series_id: number;
  title: string;
  filename: string;
  volume_number: number | null;
  page_count: number | null;
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const db = getDb();

  const series = db.prepare('SELECT * FROM series WHERE id = ?').get(Number(seriesId)) as Series | undefined;

  if (!series) {
    notFound();
  }

  const volumes = db.prepare(
    'SELECT * FROM volumes WHERE series_id = ? ORDER BY volume_number'
  ).all(series.id) as Volume[];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            href="/library"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Library
          </Link>
          <HeaderMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
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
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Volumes</h2>
          {volumes.length === 0 ? (
            <p className="text-muted">No volumes found for this series.</p>
          ) : (
            <VolumeGrid seriesId={series.id} volumes={volumes} />
          )}
        </section>
      </main>
    </div>
  );
}
