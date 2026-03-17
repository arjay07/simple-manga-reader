## Why

We have a collection of manga PDFs (~6.7GB of Dragon Ball volumes) sitting in a download folder with no way to read them comfortably from other devices on the local network. We need a self-hosted web app that lets household members browse, read, and track progress through manga — accessible from phones, tablets, and desktops on the home network.

## What Changes

- Stand up a Next.js web application serving on the local network
- PDF-based manga reader with pdf.js supporting single-page and two-page spread modes
- Right-to-left reading direction by default, configurable per user
- Library grid view with cover art (auto-extracted or manually set)
- Folder-based manga storage at `/home/arjay/manga/` with automatic scanning
- SQLite database for metadata, profiles, and reading progress
- Netflix-style profile system (no auth) with per-profile reading progress tracking
- Dark mode by default with light mode toggle
- Web-based upload for adding new manga (Phase 4)

## Capabilities

### New Capabilities
- `pdf-reader`: In-browser PDF rendering with page navigation, swipe gestures, keyboard shortcuts, and single/two-page spread modes
- `manga-library`: Grid view of manga series with cover art, folder scanning, and volume organization
- `user-profiles`: Netflix-style profile picker with per-profile reading progress, settings, and "Continue Reading"
- `theme-system`: Dark/light mode with CSS variables, dark by default, preference stored per profile
- `manga-storage`: Filesystem-based manga organization at `/home/arjay/manga/` with SQLite metadata and folder scanning

### Modified Capabilities
<!-- None - this is a greenfield project -->

## Impact

- **New project**: Next.js app with TypeScript, Tailwind CSS, better-sqlite3, pdf.js
- **Filesystem**: New manga storage directory at `/home/arjay/manga/`, migration of existing PDFs from `gdrive_downloads/`
- **Network**: App will bind to `0.0.0.0` to be accessible on the local network
- **Dependencies**: Node.js runtime required on host machine
