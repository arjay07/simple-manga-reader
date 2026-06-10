# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on 0.0.0.0:3000
npm run build        # Production build (use to verify changes compile)
npm run lint         # ESLint
npm run start        # Production server on 0.0.0.0:3000
npm test             # Vitest run (jsdom env)
npm run format       # Prettier write
npm run format:check # Prettier check (no writes)
```

## Architecture

Self-hosted manga reader. Next.js 16 App Router serves both the UI and API. Volumes live on the filesystem at `MANGA_DIR` (default `~/manga`), organized as `<Series>/<Volume>.{pdf|cbz}` (one file per volume, flat per series; `.cbz` is a ZIP archive of per-page raster images). Metadata and reading progress are stored in SQLite (`data/manga-reader.db`).

**User flow:** Profile selector (`/`) → Library grid (`/library`) → Series detail (`/library/[seriesId]`) → reader (`/read/[seriesId]/[volumeId]`).

### Key patterns

- **better-sqlite3 is synchronous.** Use `db.prepare().get()`, `.all()`, `.run()` — never `await` on db calls.
- **Next.js 15+ async params:** Route handlers use `{ params }: { params: Promise<{ id: string }> }` — await params before use.
- **Tailwind CSS v4:** No `tailwind.config.ts`. All config lives in `globals.css` using `@theme inline` and `@variant dark`. Theme colors are CSS custom properties (`--background`, `--foreground`, `--surface`, etc.) registered as Tailwind utilities (`bg-background`, `text-foreground`, etc.).
- **Dark mode:** Class strategy via `.dark` on `<html>`. An inline script in `layout.tsx` prevents flash. ThemeProvider manages state; ProfileProvider can override per-profile.
- **Startup scan:** `src/instrumentation.ts` calls `scanMangaDirectory()` on server boot to sync the filesystem into SQLite. Scanner accepts `.pdf` and `.cbz` (case-insensitive); `volumes.format` records which one.
- **DB singleton:** `src/lib/db.ts` caches a single `Database` instance. Schema is created on first access (profiles, series, volumes, reading_progress tables). `volumes.format` is `'pdf' | 'cbz'`, defaulting to `'pdf'` for pre-existing rows.
- **Server-side `PageSource` abstraction:** `src/lib/page-source/` exposes `openPageSource(filePath, format)` returning `{ countPages, extractPage, close }`. PDF backed by `pdftoppm`/`mupdf`; CBZ backed by `node-stream-zip`. Panel-detect (`extract-page.ts`, `job-manager.ts`) and the thumbnail route route through this — no direct PDF/ZIP calls in those paths.
- **Client-side `DocumentSource` abstraction:** `src/components/Reader/document-source.ts` exposes `loadDocumentSource(url, format)` returning a `DocumentSource` with `numPages` and `getPage(n)`. `PdfDocumentSource` wraps `pdfjs-dist` v5 (worker URL via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`); `CbzDocumentSource` fetches the archive, parses with JSZip, decodes images on demand into `HTMLImageElement`s with a 5-page LRU cache, and renders by `drawImage` onto the supplied canvas.
- **Panel detection (`src/lib/panel-detect/`):** Page image → `RawPanel[]` → ordered `Panel[]` stored in `panel_data`.
  - `config.ts` — `PanelDetectConfig` (nested `ml` / `readingOrder` / `contour` groups + `sessionIdleMs`) centralises every tuning threshold; `DEFAULT_PANEL_DETECT_CONFIG` reproduces historical values. `detectPanelsMl`, `assignReadingOrder`, and `detectPanelsContour` take an optional `config` and read thresholds from it — pass overrides to A/B-tune without editing code.
  - `detector.ts` — `PanelDetector` strategy interface; `getDetector(name)` returns `MlDetector` (default) or `ContourDetector`, each a thin wrapper whose `detect(buf, opts)` returns `RawPanel[]`. The `/api/panel-detect` route accepts an optional `strategy: 'ml' | 'contour'`; `job-manager.ts` uses `getDetector('ml')`.
  - `classify.ts` — shared `classifyPageType(panels)` (page type is the caller's concern, not the detector's).
  - `onnx-session.ts` — owns the lazy ONNX runtime/session lifecycle (`getSession`/`releaseSession` + idle-timeout cleaner). The queue processor schedules a release after `sessionIdleMs` of no jobs; `getSession()` cancels any pending release. No module-level session state lives in `ml.ts`.
  - **Reading order is derived at read time, not stored.** `panel_data` persists panel *geometry* (`x/y/width/height/confidence` in `panels_json`) as the source of truth; the `readingOrder` baked into `panels_json` is a non-authoritative snapshot (`reading_tree_json` is a legacy column — never read, written as `NULL`). The read paths in `src/lib/panel-data.ts` (`getPanelDataForPage` / `…ForVolume` / `…ForPages`, via the shared `rowToPage` mapper) re-run `assignReadingOrder` over the stored geometry on every read and ignore the stored order. So an ordering-algorithm or `readingOrder`-config change applies to **all** already-detected volumes on their next read — no re-detection, no migration, no backfill. The write path (`insertPanelData`, `job-manager.ts`) still writes ordered panels as a harmless default.
  - **Ordering is permutation-invariant** — a pure function of geometry and config, independent of detector emission order, pinned by a property test. The recursive XY-cut breaks all ties geometrically; regions no cut can separate fall back to tournament source selection over the pairwise reads-before relation (`isRow` → right first, else top first) — `isRow` is non-transitive, so it is never fed to `Array.sort`.
- **Cover images:** Stored in `public/covers/{seriesId}.jpg`. Uploaded via API or resolved by `src/lib/covers.ts`. Per-volume thumbnails go to `MANGA_DIR/<Series>/.covers/vol-<filename-with-ext>.jpg` — the file extension is part of the cache key so `Vol01.pdf` and `Vol01.cbz` resolve to distinct thumbnails.
- **Shared foundations:**
  - `src/types/index.ts` — canonical `Profile`, `Series`, `SeriesListItem`, `Volume`, `ProgressEntry`, `ProgressEntryWithSeries`, plus `Format` re-export. Import from `@/types` instead of redefining per-file.
  - `src/lib/constants.ts` — `STORAGE_KEYS` (theme, adminMode, profileId, smartPanelZoom, focusMode, debugMode, progress builder), `MIME_TYPES`, `mimeTypeForFormat()`. Don't inline these strings.
  - `src/lib/api-response.ts` — `apiError(message, status)`, `apiSuccess(data, status)`, `parseJsonBody<T>(request)` (returns `null` on parse failure). New routes should use these instead of `NextResponse.json` + try/catch boilerplate.
  - `src/lib/db-queries.ts` — `getSeries`, `getSeriesList`, `getVolume`, `getVolumesBySeries`, `getProfile`. Adopt these in new routes touching the same rows instead of inlining SQL.
  - `src/hooks/` — `useLocalStorage(key, initial[, options])` (SSR-safe, raw-string default, optional serialize/parse), `useFetch<T>(url, deps)` (aborts on unmount), `useClickOutside(ref, handler, enabled)` (also handles Escape).

### Providers (nested in layout.tsx)

`ThemeProvider` → `AdminProvider` → `ProfileProvider` → children. All are client components using React context with localStorage persistence. `AdminProvider` gates destructive UI actions (delete series, rescan).

### API routes

All under `src/app/api/`. Key endpoints:

- `GET /api/manga` — list all series; `GET /api/manga/[seriesId]` — series detail with volumes (volume rows include `format`)
- `GET /api/manga/[seriesId]/[volumeId]/pdf` — stream the underlying volume file (PDF or CBZ); response `Content-Type` is `application/pdf` or `application/vnd.comicbook+zip` based on the volume's `format`. Range requests honoured for both.
- `GET|POST /api/progress?profileId=&volumeId=` — read/write reading progress
- `GET|POST|DELETE /api/profiles` — profile CRUD

### Reading progress

Dual-layer persistence: localStorage caches progress immediately (`progress:{profileId}:{volumeId}`), then a debounced POST to `/api/progress` writes to SQLite and clears the localStorage entry on success.

### Environment variables

- `MANGA_DIR` — path to manga storage directory (default: `~/manga`)
- `DATABASE_PATH` — SQLite database path relative to project root (default: `data/manga-reader.db`)
