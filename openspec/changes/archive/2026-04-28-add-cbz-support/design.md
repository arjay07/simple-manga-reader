## Context

Today every code path that touches a volume assumes it's a PDF: the scanner filters on `.pdf`, the streaming/thumbnail/page-image endpoints construct paths and call `pdftoppm`/`mupdf`, the panel detection job uses `mupdf` for page count, and the client reader wires `pdfjs-dist` directly into `MangaReader.tsx`. CBZ is a fundamentally different shape — a ZIP archive of pre-rendered raster images — so we need a thin abstraction in two places (server-side page extraction, client-side document rendering) plus a format flag on volumes.

The codebase already has a clean separation between server (DB, API routes, panel detect) and client (reader, panel UI). That separation is what makes the change tractable: the abstractions don't need to cross the wire — they just need a discriminator (`format`) the API surfaces and both sides honour.

## Goals / Non-Goals

**Goals**

- Scanner picks up `.cbz` files and persists `format` on each volume row.
- Server-side panel-detect, thumbnail, and page-image paths work format-agnostically through a single `PageSource` abstraction.
- Client reader displays CBZ volumes with zoom/pan, vertical/horizontal mode, smart panel zoom, and progress persistence behaving identically to PDF — even if internal rendering differs.
- Existing PDF behaviour is byte-for-byte unchanged.
- Migration is automatic and one-shot (existing rows backfill to `'pdf'`).

**Non-Goals**

- `.cbr` (RAR archives). Different licensing situation; separate change.
- `ComicInfo.xml` ingestion. Useful but orthogonal to "make CBZ work."
- Encrypted ZIPs. We refuse to open them.
- Range-fetch of individual entries via ZIP central directory. The first cut downloads the whole archive; future optimisation if mobile memory becomes a real issue.
- Client-side decompression worker. JSZip on the main thread is acceptable for typical archive sizes; revisit if it noticeably blocks.
- Renaming the `/api/manga/[s]/[v]/pdf` route. Cosmetic; deferred.

## Decisions

### 1. Hybrid client rendering: pdfjs for PDF, JSZip for CBZ

The reader keeps `pdfjs-dist` for PDFs and adds a parallel JSZip-based path for CBZ, behind a small `DocumentSource` interface internal to `MangaReader.tsx`.

```
DocumentSource {
  numPages: number
  pageSize(n): { width, height } | Promise<{ width, height }>
  renderPage(n, canvas, opts: { widthFraction }): Promise<void>
  destroy(): void
}
```

`PdfDocumentSource` wraps the existing pdfjs flow verbatim. `CbzDocumentSource` fetches the archive bytes, parses entries with JSZip, holds a sorted list of image entries, and renders by decoding the entry into an `Image` and `drawImage`-ing it onto the supplied canvas at the requested size.

**Alternatives considered**

- _Server-side per-page image route used by the reader._ Unifies the formats but throws away pdfjs's progressive/lazy rendering for PDFs and shifts CPU to the server. Keeping PDFs on pdfjs preserves a path we've already tuned (range requests, hi-res re-render, prerender).
- _JSZip for both formats (decode PDF as binary on the client too)._ No gain — pdfjs is purpose-built and already integrated.

**Why this is fine**: the reader's logic above the render call (zoom, pan, cross-page morph, smart panel zoom, progress, prerender) operates on canvases and page numbers, not on `PDFDocumentProxy`. Wrapping pdfjs behind the interface is a small lift; CBZ becomes additive.

### 2. Server-side `PageSource` abstraction

A new module `src/lib/page-source/` exposes:

```
type Format = 'pdf' | 'cbz';

interface PageSource {
  format: Format;
  countPages(): Promise<number> | number;
  extractPage(pageNumber: number, opts?: { dpi?: number }): Promise<Buffer>; // PNG/JPEG bytes
  close(): void;
}

function openPageSource(filePath: string, format: Format): PageSource;
```

- `pdf.ts` wraps the existing `pdftoppm`/`mupdf` logic from `extract-page.ts` and `pdf-utils.ts`.
- `cbz.ts` opens the archive with `yauzl` (server-side ZIP reader, streaming, no full-archive RAM cost), enumerates image entries, sorts naturally, and returns the n-th entry's bytes.
- DPI is honoured by PDF; ignored by CBZ (raster source returned at native size).

Consumers (`extractFirstPage`, `extractPageAsImage`, `JobManager.start`'s page-count probe) all go through `openPageSource`.

**Alternatives considered**

- _Branch on extension inside each consumer._ Three call sites multiply the duplication and leave the abstraction implicit. A typed interface keeps the contract honest and centralises future formats.
- _`adm-zip` for server._ Synchronous, simpler API, but reads the whole archive into RAM. Manga CBZs run 50–300MB; on a server processing a queue, that adds up. `yauzl` streams.

### 3. Format detection: DB column populated by scanner

`volumes.format` (`'pdf' | 'cbz'`) is populated from the file extension at scan time. Existing rows backfill to `'pdf'` in the same migration that adds the column.

API responses (`/api/manga`, `/api/manga/[seriesId]`) include `format` so the client can pick the right `DocumentSource` without a separate request.

**Alternatives considered**

- _Sniff the extension on every read._ Workable but means the format check is duplicated in many spots; a column makes it cheap.
- _Sniff magic bytes from the file._ Strictly more correct but unnecessary — manga files are almost universally named with the right extension, and a mis-named file would also break the user's local file manager.

### 4. Natural sort of CBZ entries

Entries are sorted with `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` so `page_2.jpg` comes before `page_10.jpg`, and uppercase/lowercase don't matter. Directories and non-image entries (`ComicInfo.xml`, `__MACOSX/*`, `Thumbs.db`, hidden files starting with `.`) are skipped.

Recognised image extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` (browsers and `sharp` both handle these natively, so no transcoding needed for client display; panel detect feeds raw bytes to its image pipeline).

### 5. Streaming endpoint stays at `/pdf`

`/api/manga/[seriesId]/[volumeId]/pdf` is generalised to look up the volume's `format`, set `Content-Type` accordingly (`application/pdf` or `application/vnd.comicbook+zip`), and stream the underlying file with the same range-request handling. The route name stays for now — renaming is a cosmetic improvement at the cost of a deployed-URL break, and no caller besides `MangaReader.tsx` uses it.

### 6. Hi-res re-render and zoom

`PdfDocumentSource.renderPage` re-renders pdfjs at higher scale on zoom (existing behaviour). `CbzDocumentSource.renderPage` cannot — the source bytes are fixed-resolution. CSS zoom on the canvas suffices visually because manga raster sources are typically 1500–2500px tall, comfortably above viewport resolution. We do not upscale via `sharp` server-side; that would add CPU and round-trips for marginal gain on already-high-res input.

If a CBZ ships small images and looks soft when zoomed, that's a property of the source and not something this change tries to fix.

### 7. Prefetch and prerender for CBZ

`pdf-page-prerender` capability rendering ahead applies; for CBZ the implementation eagerly decodes the next/prev image entry into an `Image` and caches it keyed by page number. Cap the cache to a small ring (e.g., 5 pages) so the heap doesn't grow unbounded for long volumes.

## Risks / Trade-offs

- **Memory on mobile for big archives** → Document a soft size ceiling (~500MB) and skip fancy mobile work in this change. If real reports come in, follow up with central-directory + range-fetch.
- **JSZip on main thread blocks during initial parse of huge archives** → Acceptable for typical manga sizes; if it bites, move parse into a Web Worker as a follow-up.
- **PDFs and CBZs diverge on zoom sharpness** → Communicated above; only matters for CBZs with low source resolution, which is a content-quality issue.
- **Streaming endpoint serves binary blobs of two MIME types** → Tests should verify both `Content-Type` and range handling for each. Trivial to get wrong if the path picks the wrong format.
- **Extension mismatch (e.g., a `.cbz` that's actually `.zip` from a manual rename, or a `.pdf` that's a renamed CBZ)** → We trust the extension; anything else fails at first read with a clear error rather than silently misbehaving.
- **`yauzl` is callback-based** → Wrap in a small promise helper. Or pick `node-stream-zip` (promise-friendly). Decide during implementation; both meet the contract.

## Migration Plan

1. Schema migration runs on first boot after deploy:
   - `ALTER TABLE volumes ADD COLUMN format TEXT NOT NULL DEFAULT 'pdf'` (so existing rows are valid).
2. Scanner sets `format` from extension when inserting new rows; doesn't touch existing rows.
3. No data backfill needed — existing libraries are PDF-only by construction.
4. Rollback: drop the column or revert the binary; no destructive changes elsewhere.

## Open Questions

- **`yauzl` vs `node-stream-zip`** — pick during implementation based on which has the cleaner promise API for our use (both are mature; either is fine).
- **JPEG vs PNG output from CBZ page-image extraction** — for panel detect, ML model takes raw image bytes; whatever format the entry already is should pass through. Worth confirming the ML pipeline accepts JPEG (it does, via `sharp`/decoding step). If it expects PNG specifically, transcode in the CBZ source; otherwise pass raw.
- **Vertical-scroll mode** for CBZ — uses the same page-by-page render path; no special work expected, but verify the pre-render cache size is sized for vertical mode's wider working set.
