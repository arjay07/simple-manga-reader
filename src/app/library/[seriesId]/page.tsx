import { getDb } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HeaderMenu } from '@/components/HeaderMenu';
import { SeriesClientContent } from './SeriesClientContent';

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
        <SeriesClientContent series={series} volumes={volumes} />
      </main>
    </div>
  );
}
