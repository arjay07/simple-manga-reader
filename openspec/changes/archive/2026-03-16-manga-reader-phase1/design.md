## Context

Greenfield project: a self-hosted manga PDF reader web app for a home network. The host machine is a Linux PC with ~6.7GB of Dragon Ball manga PDFs currently in an unorganized download folder. The app needs to serve 2-3 household members across phones, tablets, and desktops.

No existing infrastructure — this is the first service being set up on this machine for local network access.

## Goals / Non-Goals

**Goals:**
- Render manga PDFs in-browser with smooth page navigation and touch/keyboard support
- Provide a library view with cover art for browsing manga series
- Track reading progress per user profile
- Support both RTL (default) and LTR reading directions
- Dark/light theming with dark as default
- Run as a single process accessible to all devices on the local network

**Non-Goals:**
- Authentication/security (trusted home network, Netflix-style profile picker only)
- Online manga sources or scraping
- CBZ/CBR/EPUB support (PDF only for now)
- Mobile native apps (web-only)
- Cloud deployment or remote access
- Real-time multi-user sync

## Decisions

### 1. Next.js App Router (full-stack)
**Choice**: Next.js with App Router for both frontend and API
**Alternatives**: Vite + Express, Vite + Hono, Remix
**Rationale**: Single process, single port, built-in file serving and API routes. App Router provides React Server Components for fast library page loads. Simpler deployment than managing two separate processes.

### 2. pdf.js for rendering
**Choice**: Mozilla pdf.js (`pdfjs-dist`) for client-side PDF rendering
**Alternatives**: Pre-extracting pages as images server-side (PyMuPDF/sharp), iframe embed
**Rationale**: No server-side processing needed, works on all devices, well-maintained. Avoids the 2-3x disk space cost of pre-extracted images. Trade-off is heavier client-side work, but manga PDFs are typically image-heavy and render fast.

### 3. SQLite via better-sqlite3
**Choice**: better-sqlite3 (synchronous, fast)
**Alternatives**: Prisma + SQLite, Drizzle + SQLite, JSON files
**Rationale**: Zero config, no external process, synchronous API is simpler for a single-server app. Direct SQL gives full control without ORM overhead. We'll use Drizzle only if query complexity grows.

### 4. Filesystem-based manga storage
**Choice**: Organized folder structure at `/home/arjay/manga/` with convention: `<Series>/<Volume>.pdf`
**Alternatives**: Database-managed blob storage, content-addressable storage
**Rationale**: User can browse/manage files directly. Simple `fs.readdir` scanning. Metadata stored in SQLite, files stay on disk in a human-readable structure.

### 5. Tailwind CSS for styling
**Choice**: Tailwind CSS with CSS custom properties for theming
**Alternatives**: CSS Modules, styled-components, shadcn/ui
**Rationale**: Fast to build responsive layouts. Dark mode via `class` strategy with CSS variables. Good ecosystem of headless UI components if needed later.

### 6. Cover art strategy
**Choice**: Auto-extract first page of first volume as cover using pdf.js canvas rendering, with option to upload a custom cover
**Alternatives**: Require manual cover upload, use external metadata APIs
**Rationale**: Good default that works offline with no user effort. Custom upload handles cases where the first page isn't ideal.

## Architecture

```
/home/arjay/projects/manga-reader/     (project root)
├── src/
│   ├── app/                            (Next.js App Router)
│   │   ├── page.tsx                    (profile selector)
│   │   ├── library/page.tsx            (manga grid)
│   │   ├── read/[series]/[volume]/     (reader view)
│   │   └── api/
│   │       ├── manga/                  (library & scan endpoints)
│   │       ├── profiles/               (CRUD profiles)
│   │       └── progress/               (reading progress)
│   ├── components/
│   │   ├── Reader/                     (pdf.js reader, page nav, gestures)
│   │   ├── Library/                    (grid, cover cards)
│   │   └── Profile/                    (picker, avatar)
│   ├── lib/
│   │   ├── db.ts                       (SQLite connection & queries)
│   │   ├── scanner.ts                  (filesystem manga scanner)
│   │   └── pdf.ts                      (pdf.js utilities)
│   └── styles/
│       └── globals.css                 (Tailwind + CSS variables for theming)
├── data/
│   └── manga-reader.db                (SQLite database)
└── public/
    └── covers/                         (extracted/uploaded cover images)

/home/arjay/manga/                      (manga storage, outside project)
├── Dragon Ball/
│   ├── DRAGON BALL VOLUME 01.pdf
│   └── ...
└── [Future Series]/
```

## Database Schema

```sql
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  avatar TEXT,                          -- emoji or color identifier
  reading_direction TEXT DEFAULT 'rtl', -- 'rtl' or 'ltr'
  theme TEXT DEFAULT 'dark',            -- 'dark' or 'light'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE series (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  folder_name TEXT NOT NULL UNIQUE,     -- maps to filesystem folder
  cover_path TEXT,                      -- path to cover image
  author TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE volumes (
  id INTEGER PRIMARY KEY,
  series_id INTEGER REFERENCES series(id),
  title TEXT NOT NULL,
  filename TEXT NOT NULL,               -- PDF filename
  volume_number INTEGER,
  page_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reading_progress (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id),
  volume_id INTEGER REFERENCES volumes(id),
  current_page INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, volume_id)
);
```

## Risks / Trade-offs

- **[Large PDF rendering on mobile]** → Some manga volumes can be 200+ MB. pdf.js loads pages on-demand, so memory usage scales with visible pages, not file size. Monitor and add page pre-loading limits if needed.
- **[No auth on local network]** → Any device on the network can access any profile. Acceptable for a trusted household. Could add optional PIN per profile later.
- **[Filesystem as source of truth for files]** → If files are moved/renamed outside the app, the DB goes stale. The scanner will reconcile on each scan, marking missing volumes.
- **[Single process, no workers]** → Cover extraction and folder scanning happen in the main Next.js process. For the current scale (30 volumes), this is fine. If the library grows to hundreds, we may need background workers.

## Migration Plan

1. Create `/home/arjay/manga/Dragon Ball/` directory
2. Move existing PDFs from `gdrive_downloads/` to the new location
3. Run initial folder scan to populate the database
4. Clean up partial download file (`.part` file in gdrive_downloads)
