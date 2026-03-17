## Why

Users lose their reading position when navigating away from a volume or refreshing the page. The reader always starts at page 1, even though progress is already being saved to SQLite via `POST /api/progress`. The save pipeline exists but the load pipeline doesn't — progress is written but never read back. This makes multi-session reading frustrating, especially for long volumes.

## What Changes

- **Load saved progress on volume open** — fetch the user's last-read page from SQLite and start the reader there instead of page 1.
- **localStorage write-through cache** — write current page to localStorage immediately on every page change so progress survives refresh even during the 1s debounce window before the DB save fires.
- **Silent resume** — jump directly to saved page with no confirmation prompt.
- **Progress indicators in library** — show reading progress (page X/Y) on volume cards in the series detail page.
- **Continue Reading section** — add a section to the library that surfaces the most recently read volume with a one-tap resume link.

## Capabilities

### New Capabilities

- `progress-resume`: Loading saved reading progress when opening a volume and surviving page refresh via localStorage cache.
- `library-progress-ui`: Displaying reading progress on volume cards and providing a "Continue Reading" entry point in the library.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **`src/app/read/[seriesId]/[volumeId]/page.tsx`** — fetch progress from DB, pass as `initialPage` prop
- **`src/components/Reader/MangaReader.tsx`** — read/write localStorage cache, use max(db, local) on mount
- **`src/app/library/[seriesId]/page.tsx`** — fetch and display per-volume progress
- **`src/app/library/page.tsx`** — add Continue Reading section using existing `GET /api/progress` endpoint
- **`src/app/api/progress/route.ts`** — may need a single-volume GET variant (currently returns all progress for a profile)
- **No new dependencies** — uses existing SQLite schema, localStorage, and pdfjs-dist
