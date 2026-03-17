# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on 0.0.0.0:3000
npm run build        # Production build (use to verify changes compile)
npm run lint         # ESLint
npm run start        # Production server on 0.0.0.0:3000
```

No test framework is configured.

## Architecture

Self-hosted manga PDF reader. Next.js 16 App Router serves both the UI and API. Manga PDFs live on the filesystem at `MANGA_DIR` (default `~/manga`), organized as `<Series>/<Volume>.pdf`. Metadata and reading progress are stored in SQLite (`data/manga-reader.db`).

**User flow:** Profile selector (`/`) → Library grid (`/library`) → Series detail (`/library/[seriesId]`) → PDF reader (`/read/[seriesId]/[volumeId]`).

### Key patterns

- **better-sqlite3 is synchronous.** Use `db.prepare().get()`, `.all()`, `.run()` — never `await` on db calls.
- **Next.js 15+ async params:** Route handlers use `{ params }: { params: Promise<{ id: string }> }` — await params before use.
- **Tailwind CSS v4:** No `tailwind.config.ts`. All config lives in `globals.css` using `@theme inline` and `@variant dark`. Theme colors are CSS custom properties (`--background`, `--foreground`, `--surface`, etc.) registered as Tailwind utilities (`bg-background`, `text-foreground`, etc.).
- **Dark mode:** Class strategy via `.dark` on `<html>`. An inline script in `layout.tsx` prevents flash. ThemeProvider manages state; ProfileProvider can override per-profile.
- **Startup scan:** `src/instrumentation.ts` calls `scanMangaDirectory()` on server boot to sync the filesystem into SQLite.
- **DB singleton:** `src/lib/db.ts` caches a single `Database` instance. Schema is created on first access (profiles, series, volumes, reading_progress tables).
- **PDF rendering:** Client-side via pdfjs-dist v5. Worker configured with `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.
- **Cover images:** Stored in `public/covers/{seriesId}.jpg`. Uploaded via API or resolved by `src/lib/covers.ts`.

### Providers (nested in layout.tsx)

`ThemeProvider` → `AdminProvider` → `ProfileProvider` → children. All are client components using React context with localStorage persistence. `AdminProvider` gates destructive UI actions (delete series, rescan).

### API routes

All under `src/app/api/`. Key endpoints:
- `GET /api/manga` — list all series; `GET /api/manga/[seriesId]` — series detail with volumes
- `GET /api/manga/[seriesId]/[volumeId]/pdf` — stream PDF file for reader
- `GET|POST /api/progress?profileId=&volumeId=` — read/write reading progress
- `GET|POST|DELETE /api/profiles` — profile CRUD

### Reading progress

Dual-layer persistence: localStorage caches progress immediately (`progress:{profileId}:{volumeId}`), then a debounced POST to `/api/progress` writes to SQLite and clears the localStorage entry on success.

### Environment variables

- `MANGA_DIR` — path to manga storage directory (default: `~/manga`)
- `DATABASE_PATH` — SQLite database path relative to project root (default: `data/manga-reader.db`)
