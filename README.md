# Manga Reader

A self-hosted web app for reading manga PDFs. Built with Next.js, SQLite, and client-side PDF rendering.

## Features

- **PDF reader** with right-to-left and left-to-right reading modes, vertical scroll, and page navigation
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

Set `MANGA_DIR` to point to your manga folder (defaults to `/home/arjay/manga`).

```bash
MANGA_DIR=/path/to/manga npm run start
```

The dev server with hot reload:

```bash
npm run dev
```
