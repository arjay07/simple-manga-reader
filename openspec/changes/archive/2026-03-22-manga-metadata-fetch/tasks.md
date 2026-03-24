## 1. Database Schema

- [x] 1.1 Add `description TEXT`, `author TEXT`, and `mangadex_id TEXT` columns to the `series` table in `src/lib/db.ts` using `ALTER TABLE … ADD COLUMN IF NOT EXISTS`

## 2. MangaDex API Client

- [x] 2.1 Create `src/lib/mangadex.ts` with a `searchManga(title: string)` function that calls `https://api.mangadex.org/manga?title=…&limit=5` and returns normalized candidates (`mangadexId`, `title`, `description`, `author`)
- [x] 2.2 Add a `getMangaAuthors(mangaId: string, relationships)` helper that resolves author/artist names from the `relationships` array returned by MangaDex

## 3. API Routes

- [x] 3.1 Create `src/app/api/manga/[seriesId]/metadata/search/route.ts` — `GET` handler that calls `searchManga()` with the series title and returns candidates
- [x] 3.2 Create `src/app/api/manga/[seriesId]/metadata/route.ts` — `POST` handler that validates the request body and updates `description`, `author`, `mangadex_id` on the series row

## 4. Series Detail Page — Display

- [x] 4.1 Update the series detail page API response (`GET /api/manga/[seriesId]`) to include `description` and `author` fields
- [x] 4.2 Render the `description` block on the series detail page when the field is non-null
- [x] 4.3 Render the `author` line on the series detail page when the field is non-null

## 5. Fetch Metadata UI

- [x] 5.1 Add a "Fetch Metadata" button to the series detail page, visible only when admin mode is active
- [x] 5.2 On button click, call `GET /api/manga/[seriesId]/metadata/search` and display the top result in a confirmation dialog/modal showing title, author, and a truncated description
- [x] 5.3 On confirmation, call `POST /api/manga/[seriesId]/metadata` with the chosen candidate and refresh the page data to show the newly saved metadata
- [x] 5.4 Handle error states: show an error message if the search fails or returns no results, and allow the admin to dismiss without saving
