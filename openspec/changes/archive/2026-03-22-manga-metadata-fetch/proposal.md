## Why

The library currently displays only filenames and cover images with no contextual information about each series. Fetching metadata from MangaDex gives readers descriptions and author credits without any manual data entry, making the library more informative and easier to browse.

## What Changes

- New API route to search and fetch manga metadata from MangaDex by series name
- New API route to save fetched metadata to the database for a series
- Database schema extended with `description`, `author`, and `mangadex_id` columns on the `series` table
- Series detail page updated to display description and author when available
- "Fetch Metadata" button added to the series detail page (admin mode only) to trigger on-demand lookup

## Capabilities

### New Capabilities

- `manga-metadata-fetch`: Search MangaDex by series title, retrieve description and author/artist, persist to SQLite, and surface on the series detail page

### Modified Capabilities

<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Database:** `series` table gains `description TEXT`, `author TEXT`, `mangadex_id TEXT` columns
- **API:** Two new routes — `GET /api/manga/[seriesId]/metadata/search` and `POST /api/manga/[seriesId]/metadata`
- **UI:** Series detail page (`/library/[seriesId]`) updated to render description and author; fetch button gated behind admin mode
- **Dependencies:** No new npm packages required — MangaDex API is a plain REST API called with `fetch`
