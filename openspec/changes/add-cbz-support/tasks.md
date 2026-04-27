## 1. Schema and dependencies

- [ ] 1.1 Add `format TEXT NOT NULL DEFAULT 'pdf'` column to the `volumes` table in `src/lib/db.ts`, including the migration block that adds it to existing databases
- [ ] 1.2 Add `jszip` as a runtime dependency
- [ ] 1.3 Pick and add a server-side ZIP reader dependency (`yauzl` or `node-stream-zip`) — confirm choice in design's Open Questions before adding
- [ ] 1.4 Verify the project still type-checks and `npm run build` succeeds after dependency changes

## 2. Server-side `PageSource` abstraction

- [ ] 2.1 Create `src/lib/page-source/types.ts` exporting `Format` and the `PageSource` interface as described in design.md
- [ ] 2.2 Create `src/lib/page-source/pdf.ts` that wraps the existing `pdftoppm`/`mupdf` extraction and page-count logic from `extract-page.ts` and `job-manager.ts`
- [ ] 2.3 Create `src/lib/page-source/cbz.ts` that opens an archive, enumerates entries, filters to recognised image extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`), skips directories / `__MACOSX/` / `Thumbs.db` / dotfiles / `ComicInfo.xml`, sorts via `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`, and returns the n-th entry's bytes
- [ ] 2.4 Create `src/lib/page-source/index.ts` exporting `openPageSource(filePath, format)` factory
- [ ] 2.5 Make `cbz.ts` throw a clear error for archives with zero recognised image entries, encrypted archives, or non-ZIP payloads

## 3. Scanner

- [ ] 3.1 Update file filter in `src/lib/scanner.ts` to accept both `.pdf` and `.cbz` (case-insensitive)
- [ ] 3.2 Update the insert statement and call site to populate `format` from the file extension
- [ ] 3.3 Update `extractVolumeNumber()` to no longer anchor on `.pdf$` — last regex becomes `(\d+)\.(?:pdf|cbz)$/i`
- [ ] 3.4 Replace `path.basename(filename, '.pdf')` with `path.basename(filename, path.extname(filename))` so titles strip whichever extension is present

## 4. Server-side consumers route through `PageSource`

- [ ] 4.1 Refactor `src/lib/panel-detect/extract-page.ts` so `extractPageAsImage(volume, page, dpi?)` looks up the volume's `format` and delegates to `openPageSource(filePath, format).extractPage(page, { dpi })`
- [ ] 4.2 Update `src/lib/panel-detect/job-manager.ts` so its page-count probe (currently hard-coded to mupdf) goes through `openPageSource(filePath, format).countPages()`
- [ ] 4.3 Update `src/app/api/panel-detect/page-image/route.ts` to fetch `format` from the DB row and pass it through to `extractPageAsImage`
- [ ] 4.4 Update `src/app/api/manga/[seriesId]/[volumeId]/thumbnail/route.ts` so it produces a thumbnail for both formats; for CBZ, extract the first image entry and run it through `sharp` to produce the cached JPEG
- [ ] 4.5 Move `getVolumeThumbnailPath()` in `src/lib/pdf-utils.ts` to be format-agnostic — strip whichever extension is present so the cache key works for `.pdf` and `.cbz`
- [ ] 4.6 Update `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts` to read the volume's `format` and set `Content-Type` to `application/pdf` or `application/vnd.comicbook+zip` accordingly; range-request handling unchanged

## 5. API surface

- [ ] 5.1 Update `src/app/api/manga/route.ts` to include `format` in the volume listing response
- [ ] 5.2 Update `src/app/api/manga/[seriesId]/route.ts` to include `format` on each volume in the series detail response
- [ ] 5.3 Update any TypeScript volume types used by the client to include `format: 'pdf' | 'cbz'`

## 6. Client-side `DocumentSource` abstraction

- [ ] 6.1 Inside `src/components/Reader/MangaReader.tsx`, define the `DocumentSource` interface (numPages, pageSize, renderPage, destroy)
- [ ] 6.2 Extract the existing pdfjs flow into a `PdfDocumentSource` that constructs from a fetched URL and implements the interface using the current `getDocument` and `page.render` calls
- [ ] 6.3 Add a `CbzDocumentSource` that fetches the archive bytes, parses with JSZip, builds a sorted list of image entries (same natural-sort + filtering rules as the server), exposes `numPages`, decodes pages on demand into `HTMLImageElement`s, and `drawImage`s them onto the supplied canvas with the same width/height fitting logic
- [ ] 6.4 Replace the reader's PDF load `useEffect` with a format-dispatched `useEffect` that constructs the right `DocumentSource` from the volume's `format`
- [ ] 6.5 Replace the existing `renderPage` function so it calls `documentSource.renderPage(...)` instead of pdfjs APIs directly
- [ ] 6.6 Add a small in-memory ring cache in `CbzDocumentSource` (≤5 decoded `Image`s) keyed by page number to feed the existing prerender hook

## 7. Verification

- [ ] 7.1 Place a small test CBZ in `MANGA_DIR`, restart the dev server, confirm the scan logs the new volume with `format = 'cbz'`
- [ ] 7.2 Confirm thumbnail generation succeeds for the CBZ volume in the library grid
- [ ] 7.3 Open the CBZ volume in the reader and verify: page navigation, zoom, pan, vertical mode toggle, smart panel zoom, progress save/restore, prev/next-volume navigation
- [ ] 7.4 Run a panel-detection job against the CBZ volume from `/admin/panel-jobs` and confirm pages are processed and saved with correct page count
- [ ] 7.5 Open `/api/panel-detect/page-image?...` for the CBZ volume and confirm a valid base64 JPEG is returned with correct dimensions
- [ ] 7.6 Confirm an existing PDF volume in the same library still opens and reads identically to before (no regression)
- [ ] 7.7 Try a deliberately corrupt `.cbz` (e.g., an empty file renamed to `.cbz`) and confirm both the reader and the panel-detect path surface a clear error

## 8. Cleanup

- [ ] 8.1 Remove any now-dead PDF-only branches in code paths that have been routed through `PageSource`
- [ ] 8.2 `npm run lint` clean
- [ ] 8.3 `npm run build` clean
- [ ] 8.4 Update `CLAUDE.md`'s Architecture section to mention CBZ alongside PDF and reference the `PageSource`/`DocumentSource` abstractions
