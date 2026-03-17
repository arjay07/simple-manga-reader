## Context

The manga reader currently has individual Rescan and Theme toggle buttons in the library header, no admin concept, a cover upload API with no UI, and plain placeholders for volume cards. This design introduces an admin mode, consolidated header menu, cover art management, and on-demand volume thumbnails.

Current provider stack: `ThemeProvider` → `ProfileProvider` → children.

Cover images are stored at `public/covers/{seriesId}.jpg` and resolved by `src/lib/covers.ts`. The cover upload API at `POST /api/manga/[seriesId]/cover` already accepts multipart form data.

## Goals / Non-Goals

**Goals:**
- Consolidate header controls into a single dropdown menu
- Provide a simple admin mode toggle that shows/hides management UI
- Let admins set series cover art via upload, URL, or auto-generation
- Display volume thumbnails extracted from PDF first pages
- Cache volume thumbnails on disk for fast subsequent loads

**Non-Goals:**
- Authentication or authorization for admin mode (simple toggle only)
- Batch cover operations across multiple series
- Custom volume cover art (volumes always use first-page extraction)
- Server-side PDF rendering library — will use CLI tool (`pdftoppm`) for simplicity

## Decisions

### 1. AdminProvider context pattern
**Choice**: New `AdminProvider` React context wrapping the app, mirroring the ThemeProvider pattern.
**Rationale**: Consistent with existing architecture. Any component can call `useAdmin()` to check `isAdmin`. State stored in localStorage key `admin-mode`.
**Alternative considered**: URL query param (`?admin=true`) — rejected because it would need to be threaded through every link.

### 2. Consolidated header menu component
**Choice**: Single `HeaderMenu` component rendering a ⋮ button with a dropdown. Contains Admin toggle (switch), Theme toggle, and Rescan button.
**Rationale**: Keeps the header clean and extensible. The existing `ThemeToggle` and `RescanButton` logic moves into the dropdown as menu items.
**Alternative considered**: Keep existing buttons and add ⋮ alongside — rejected to reduce header clutter.

### 3. Volume thumbnail generation via `pdftoppm`
**Choice**: Shell out to `pdftoppm` (from poppler-utils) to extract page 1 as JPEG.
**Rationale**: `pdftoppm` is battle-tested, fast, and avoids pulling `node-canvas` (native dependency with build complexity) into the project. It's a standard package on most Linux systems. The app is self-hosted, so system dependency is acceptable.
**Command**: `pdftoppm -jpeg -f 1 -l 1 -r 150 -singlefile <input.pdf> <output-prefix>`
**Alternative considered**: pdfjs-dist on Node with canvas — rejected due to native `canvas` npm package build complexity and memory overhead.

### 4. On-demand thumbnail caching
**Choice**: `GET /api/manga/[seriesId]/[volumeId]/thumbnail` checks for cached file at `public/covers/volumes/{volumeId}.jpg`. If missing, generates it via `pdftoppm`, saves, then redirects to the static file.
**Rationale**: No upfront scan cost. Thumbnails generated lazily on first view. Subsequent requests served as static files by Next.js.
**Alternative considered**: Pre-generate during scan — rejected per user preference for on-demand approach.

### 5. Cover from URL — server-side download
**Choice**: Extend `POST /api/manga/[seriesId]/cover` to accept `{ url: string }` JSON body (in addition to existing multipart form upload). Server fetches the image, validates content-type, saves to `public/covers/{seriesId}.jpg`.
**Rationale**: Reuses existing endpoint. Content-type validation prevents non-image downloads. Size limit (10MB) prevents abuse.
**Alternative considered**: Separate endpoint — rejected to keep API surface small.

### 6. Auto-generate series cover from Volume 1
**Choice**: Reuse the same `pdftoppm` extraction logic used for volume thumbnails. Find the first volume (lowest `volume_number`) and extract its first page as the series cover.
**Rationale**: Shares implementation with volume thumbnails. Saves the result to the standard `public/covers/{seriesId}.jpg` path and updates the database.

### 7. Series card admin menu
**Choice**: Overlay a ⋮ button on the top-right corner of `SeriesCard` when `isAdmin` is true. Clicking opens a dropdown with: Upload Cover, Set Cover from URL, Auto-generate Cover.
**Rationale**: Non-intrusive — only visible in admin mode. Positioned over the cover image to be contextually clear.

## Risks / Trade-offs

- **`pdftoppm` system dependency** → Document in README. Check for binary on app startup and log a warning if missing. The app still functions without it — thumbnails just won't generate.
- **Disk usage from cached thumbnails** → Each thumbnail at 150 DPI is ~50-150KB. For 1000 volumes, that's ~50-150MB. Acceptable for self-hosted. Could add a "clear thumbnail cache" admin action later.
- **Race condition on concurrent thumbnail requests** → First request generates, subsequent requests for the same volume could trigger duplicate generation. Mitigate with a simple lock file or check-before-write. Low risk in practice (single-user app).
- **URL download safety** → Validate content-type header from remote server. Enforce size limit. Only allow http/https schemes.
