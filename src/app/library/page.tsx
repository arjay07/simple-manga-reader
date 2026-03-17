import { getDb } from '@/lib/db';
import { getMangaDir } from '@/lib/settings';
import { SeriesCard } from '@/components/Library/SeriesCard';
import { ContinueReading } from '@/components/Library/ContinueReading';
import { HeaderMenu } from '@/components/HeaderMenu';
import { GDriveOverlay } from '@/components/GDrive/GDriveOverlay';

export const dynamic = 'force-dynamic';

interface SeriesRow {
  id: number;
  title: string;
  folder_name: string;
  cover_path: string | null;
  volume_count: number;
}

export default function LibraryPage() {
  const mangaDir = getMangaDir();
  const db = getDb();
  const series = db.prepare(`
    SELECT s.*, COUNT(v.id) as volume_count
    FROM series s
    LEFT JOIN volumes v ON v.series_id = s.id
    GROUP BY s.id
    ORDER BY s.title
  `).all() as SeriesRow[];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Library</h1>
          <HeaderMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <ContinueReading />
        {series.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4 text-muted"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <p className="text-lg text-muted">No manga found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add folders containing PDF files to:
            </p>
            <code className="mt-1 rounded bg-surface-elevated px-3 py-1 text-sm text-foreground">
              {mangaDir}
            </code>
            <p className="mt-3 text-sm text-muted-foreground">
              Each subfolder becomes a series. Then click <strong>Rescan</strong> above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {series.map((s) => (
              <SeriesCard
                key={s.id}
                id={s.id}
                title={s.title}
                coverPath={s.cover_path}
                volumeCount={s.volume_count}
              />
            ))}
          </div>
        )}
      </main>
      <GDriveOverlay />
    </div>
  );
}
