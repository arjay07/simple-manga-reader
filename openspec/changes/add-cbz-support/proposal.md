## Why

The reader currently only recognises PDF volumes — the scanner filters for `.pdf`, the streaming/thumbnail/page-image endpoints assume PDF, the panel-detection job pipeline calls `pdftoppm`/`mupdf` on a PDF path, and the client reader uses `pdfjs-dist` to load and render. Many manga collections circulate as CBZ (zipped image archives), and forcing users to convert them to PDF is lossy (re-encoding) and slow. Supporting CBZ natively unlocks a second large content source without changing how the rest of the reader feels.

## What Changes

- **Scanner / DB**
  - Scanner accepts `.cbz` files alongside `.pdf` (case-insensitive).
  - `extractVolumeNumber()` no longer anchors regexes to `.pdf`; works on any extension.
  - **BREAKING (DB)**: `volumes` table gets a `format` column (`'pdf' | 'cbz'`) populated on scan. Existing rows backfill to `'pdf'`.
- **Server-side page-source abstraction**
  - New `PageSource` interface: `getPageCount()` and `extractPage(n, opts?) → Buffer`.
  - PDF-backed source wraps existing `pdftoppm`/`mupdf` path; CBZ-backed source uses a ZIP reader to enumerate image entries (natural-sorted) and return raw bytes.
  - `extractPageAsImage()` (panel detect) and `extractFirstPage()` (thumbnails) route through the abstraction based on `volume.format`.
- **Client reader**
  - New `DocumentSource` abstraction inside `MangaReader.tsx` with two implementations:
    - `PdfDocumentSource` — wraps current `pdfjs-dist` flow (unchanged behaviour).
    - `CbzDocumentSource` — fetches the archive once, parses entries with JSZip, exposes per-page natural-size + a `renderPage(canvas, viewport)` that draws the decoded image.
  - Reader picks source by `volume.format` returned from the API.
- **Streaming endpoint**
  - Existing `/api/manga/[s]/[v]/pdf` route generalised to serve the underlying file with the correct `Content-Type` (`application/pdf` or `application/vnd.comicbook+zip`); range requests preserved.
  - Route name kept as `/pdf` for now to avoid breaking deployed URLs (revisit in a follow-up if we want a less misleading name).
- **Panel detection / jobs**
  - Job manager and panel-detect routes resolve page count and per-page image through the `PageSource` abstraction; no remaining direct PDF calls in those paths.
  - DPI parameter ignored for raster-backed sources; pages returned at native resolution.

Out of scope: `.cbr` (RAR), `ComicInfo.xml` metadata ingestion, on-the-fly format conversion, encrypted ZIPs.

## Capabilities

### New Capabilities
- `cbz-archive-support`: End-to-end recognition and rendering of CBZ archives — scanner detection, format column, server-side page extraction, client-side reader rendering, natural-sort of entries, supported image types (jpg/jpeg/png/webp).

### Modified Capabilities
- `panel-detection`: Page-image extraction must operate format-agnostically via the `PageSource` abstraction rather than calling PDF tools directly.
- `panel-generation-jobs`: Page-count discovery and per-page iteration must work for both PDF and CBZ volumes through the same abstraction.

## Impact

- **Code**
  - `src/lib/scanner.ts` — extension filter, basename strip.
  - `src/lib/db.ts` — schema migration for `volumes.format`.
  - `src/lib/pdf-utils.ts` — split into format-aware page-source modules (`page-source/pdf.ts`, `page-source/cbz.ts`, `page-source/index.ts`).
  - `src/lib/panel-detect/extract-page.ts` — delegates to the page-source abstraction.
  - `src/lib/panel-detect/job-manager.ts` — uses page-source for page count.
  - `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts` — content-type and disposition by format.
  - `src/app/api/manga/[seriesId]/[volumeId]/thumbnail/route.ts` — uses page-source.
  - `src/app/api/panel-detect/page-image/route.ts` — uses page-source.
  - `src/components/Reader/MangaReader.tsx` — `DocumentSource` interface + `CbzDocumentSource`; routes `getDocument` vs JSZip by format.
  - `src/app/api/manga/route.ts` and `[seriesId]/route.ts` — surface `format` on volume responses.
- **Dependencies**
  - Add `jszip` (client-side reader) and a server-side ZIP reader (`yauzl` or built-in `node:zlib`-based — chosen in design).
- **APIs**
  - Volume list/detail responses include `format` field.
  - Streaming route now serves either PDF or CBZ bytes; clients must handle both content types.
- **Operational**
  - One-shot DB migration on next boot; users with existing PDF libraries see no behavioural change.
  - First scan after upgrade picks up any `.cbz` files already present in `MANGA_DIR`.
