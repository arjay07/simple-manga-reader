# Manga Reader

A self-hosted web app for reading manga PDFs. Built with Next.js, SQLite, and client-side PDF rendering.

## Features

- **PDF reader** with right-to-left and left-to-right reading modes, vertical scroll, and page navigation
- **Smart Panel Zoom** — ML-powered panel detection that auto-zooms and navigates panel-by-panel (see below)
- **Multiple profiles** with independent reading progress
- **Auto-scan** manga directory on startup — drop PDFs into folders and they appear as series
- **Resume reading** from where you left off, per profile
- **Dark/light themes** configurable per profile
- **Admin mode** for rescanning, managing series, and configuring settings
- **Mobile-friendly** with touch navigation and responsive layout

## How it works

Manga PDFs live on your filesystem organized as:

```
manga/
  Dragon Ball/
    Dragon Ball Volume 01.pdf
    Dragon Ball Volume 02.pdf
  Jujutsu Kaisen/
    JJK Vol 1.pdf
    JJK Vol 2.pdf
```

Each subfolder becomes a series. The app scans this directory on startup and tracks metadata + reading progress in a SQLite database.

## Deploy with Docker (recommended)

```bash
git clone <repo-url> manga-reader
cd manga-reader
cp .env.example .env
```

Edit `.env` and set the path to your manga folder:

```env
MANGA_DIR_HOST=/path/to/your/manga

# Windows example:
# MANGA_DIR_HOST=C:/Users/yourname/manga
```

Then start the app:

```bash
docker compose up -d
```

Open `http://localhost:3000`. Other devices on your network can access it at `http://<your-ip>:3000`.

To rebuild after pulling updates:

```bash
git pull
docker compose up -d --build
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MANGA_DIR_HOST` | *(required)* | Path to manga folder on host |
| `PORT` | `3000` | Port to expose the app on |
| `GOOGLE_API_KEY` | — | Google API key for "Add from GDrive" feature |

### HTTPS with Caddy (optional)

The repo includes a Caddy reverse proxy configuration for automatic HTTPS via DNS challenge. This works with any DNS provider supported by [caddy-dns](https://github.com/caddy-dns).

Add these to your `.env`:

```env
# Your primary domain (e.g. from DuckDNS, Cloudflare, etc.)
PRIMARY_DOMAIN=your-domain.example.com

# DNS provider name as used in Caddy (e.g. duckdns, cloudflare)
DNS_PROVIDER=duckdns

# API token for your DNS provider
DNS_TOKEN=your-dns-token

# Optional: secondary domain (e.g. for Tailscale or local network access)
# SECONDARY_DOMAIN=your-other-domain.example.com

# Optional: xcaddy plugin for your DNS provider (defaults to DuckDNS)
# DNS_PLUGIN=github.com/caddy-dns/cloudflare
```

Then build and start with Caddy:

```bash
docker compose up -d --build
```

The `:80` block serves plain HTTP for local network access (no domain needed — just use your machine's IP). Caddy handles HTTPS termination and proxies to the app.

> **Note:** Certs expire every 90 days with most providers. Caddy renews them automatically as long as the container is running.

### Data persistence

- **Manga PDFs** — mounted from your host filesystem (read-only)
- **SQLite database** — stored in a Docker volume (`manga-data`)
- **Cover images** — stored in a Docker volume (`manga-covers`)

Running `docker compose down` preserves all data. To fully reset, add `-v` to remove volumes.

## Run without Docker

Requires Node.js 22+.

```bash
npm install
npm run build
npm run start
```

Set `MANGA_DIR` to point to your manga folder (defaults to `~/manga`).

```bash
MANGA_DIR=/path/to/manga npm run start
```

The dev server with hot reload:

```bash
npm run dev
```

## Smart Panel Zoom

Smart Panel Zoom uses a YOLOv11 object detection model to identify individual manga panels on each page, then lets you navigate panel-by-panel with automatic zoom. This is especially useful on phones and tablets where full pages are too small to read comfortably.

### How it works

1. A [YOLOv11 model trained on the Manga109 dataset](https://huggingface.co/deepghs/manga109_yolo) runs server-side via ONNX Runtime to detect panel boundaries on each page
2. Detected panels are sorted into manga reading order (right-to-left for RTL, left-to-right for LTR)
3. The reader auto-zooms to each panel in sequence — tap to advance, double-tap to toggle back to full-page view
4. Panel data is cached in SQLite so detection only runs once per page

The model auto-downloads from Hugging Face on first use (~25 MB) and is stored in the `models/` directory.

### Setting up panel data

Panel detection needs to run before Smart Panel Zoom can be used. There are two admin pages for this:

**Test detection on individual pages** — `/admin/panel-detect`
- Select a series, volume, and page number
- Adjust the confidence threshold (default 0.25)
- Preview detected panels with colored overlays
- Useful for verifying detection quality before batch processing

**Batch process entire series** — `/admin/panel-jobs`
- Queue all volumes in a series for panel detection
- Monitor progress, pause/resume/cancel jobs
- View per-volume completion status
- Jobs auto-resume if the server restarts

### Enabling in the reader

Once panel data exists for a volume, open the **Reader Settings** (gear icon) in the reader and toggle **Smart Panel Zoom** on. It is available in RTL and LTR reading modes (not vertical scroll).

**Controls in panel zoom mode:**
- **Tap / click** — next panel (crosses pages automatically)
- **Double-tap** — toggle between panel zoom and full-page view
- **Swipe** — preview the next panel with an animated transition
- **Scroll wheel** — navigate between panels

## Tech stack

| Component | Library |
|-----------|---------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) v4 |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| PDF rendering (client) | [pdfjs-dist](https://github.com/nickolay/nickolay-pdfjs) (Mozilla PDF.js) |
| PDF page extraction (server) | [mupdf](https://mupdf.com/) |
| Panel detection model | [YOLOv11 trained on Manga109](https://huggingface.co/deepghs/manga109_yolo) via [ONNX Runtime](https://onnxruntime.ai/) |
| Image processing | [sharp](https://sharp.pixelplumbing.com/) |
