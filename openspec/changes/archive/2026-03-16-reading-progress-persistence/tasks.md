## 1. API — Single-volume progress query

- [x] 1.1 Add optional `volumeId` query parameter to `GET /api/progress/route.ts` that returns a single progress record (or null) when provided alongside `profileId`

## 2. Server-side resume on volume open

- [x] 2.1 Update `read/[seriesId]/[volumeId]/page.tsx` to read `profileId` from searchParams, query the DB for saved progress, and pass the result as `initialPage` to `MangaReader`

## 3. localStorage write-through cache

- [x] 3.1 In `MangaReader.tsx`, write current page to localStorage (`progress:{profileId}:{volumeId}`) immediately on every page change (no debounce)
- [x] 3.2 On mount, read localStorage value and compare with `initialPage` prop — use `Math.max()` as the starting page
- [x] 3.3 Clear the localStorage key after the debounced DB save succeeds

## 4. Library — Progress indicators on volume cards

- [x] 4.1 In the series detail page (`library/[seriesId]/page.tsx`), fetch reading progress for the active profile and pass it to volume cards
- [x] 4.2 Add a progress bar and "page X / Y" text to volume cards that have saved progress

## 5. Library — Continue Reading section

- [x] 5.1 In the library page (`library/page.tsx`), fetch the most recently read volume for the active profile using `GET /api/progress`
- [x] 5.2 Render a "Continue Reading" section with the volume cover, title, series name, and progress — linking to the reader at the saved page
- [x] 5.3 Hide the section when the profile has no reading history

## 6. Verification

- [x] 6.1 Verify `npm run build` succeeds with no type errors
- [x] 6.2 Manual test: open a volume, navigate to a page, close, reopen — should resume at saved page
- [x] 6.3 Manual test: navigate to a page and refresh — should not reset to page 1
