## Why

The manga reader has no way to manage cover art through the UI — the upload API exists but is inaccessible to users. Volumes display plain numbered placeholders instead of visual thumbnails, making it hard to identify volumes at a glance. Adding an admin mode with cover management and volume thumbnails will make the library feel polished and browsable.

## What Changes

- **Consolidated header menu**: Replace the separate Rescan and Theme toggle buttons with a single vertical-dots (⋮) dropdown menu in the top-right corner of the library and series detail headers.
- **Admin Mode toggle**: Add a simple UI toggle (no authentication) inside the header dropdown menu. State persists in localStorage.
- **Series cover art management**: When Admin Mode is active, series cards display a ⋮ menu with options to upload an image, download from a URL, or auto-generate a cover from Volume 1's first page.
- **Volume thumbnail generation**: An on-demand API endpoint extracts the first page of each volume PDF, caches it to disk, and serves it as the volume's cover image.
- **AdminProvider context**: A new React context (similar to ThemeProvider) that exposes `isAdmin` state to all components.

## Capabilities

### New Capabilities
- `admin-mode`: Admin Mode toggle UI, AdminProvider context, localStorage persistence, and conditional rendering of admin-only controls.
- `cover-art-management`: Series cover art menu with upload, URL download, and auto-generate from Volume 1 options.
- `volume-thumbnails`: On-demand server-side PDF first-page extraction with disk caching for volume cover images.
- `header-menu`: Consolidated vertical-dots dropdown replacing individual header buttons, containing Admin toggle, Theme toggle, and Rescan.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Components**: SeriesCard, CoverImage, library page header, series detail header — all gain new or modified UI.
- **New components**: HeaderMenu, AdminProvider, SeriesCardMenu.
- **API**: New `GET /api/manga/[seriesId]/[volumeId]/thumbnail` endpoint. Extended `POST /api/manga/[seriesId]/cover` to accept URL-based downloads.
- **Dependencies**: Server-side PDF rendering needed — either `pdfjs-dist` on Node with `canvas`, or shelling out to `pdftoppm` (poppler-utils).
- **Files**: `public/covers/volumes/` directory for cached volume thumbnails.
- **Providers**: New AdminProvider added to the provider stack in layout.tsx.
