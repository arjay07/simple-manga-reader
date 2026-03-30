## Context

The manga reader currently has a PDF-only pipeline: scanner finds `.pdf` files, extractor renders PDF pages to WebP via pdfjs-dist + node-canvas + sharp, and the client loads the raw PDF via pdfjs-dist for canvas rendering. A parallel path serves pre-extracted WebP pages via `/api/.../page/N`.

CBZ and CBR are the other dominant manga formats — ZIP and RAR archives of image files respectively. Adding support requires touching the scanner, extractor, reader, and thumbnail generation.

## Goals / Non-Goals

**Goals:**
- Support CBZ and CBR files alongside PDF with no user configuration
- Unify the reader to use pre-extracted WebP pages for all formats, eliminating client-side format awareness
- Remove pdfjs-dist from the client bundle (significant bundle size reduction)
- Zero system-level dependencies for CBR (use WASM-based extraction)

**Non-Goals:**
- Streaming/on-demand page extraction (all extraction happens eagerly at scan time)
- Support for other archive formats (CB7, CBT, etc.) — can be added later using the same pattern
- Converting between formats
- Nested archive support (archives within archives)

## Decisions

### 1. Unified pre-extracted page rendering for all formats

**Decision**: Replace client-side pdfjs rendering with `<img>` tags loading from `/api/.../page/N` for all formats.

**Rationale**: The pre-extraction pipeline (`data/pages/{volId}/NNN.webp`) already exists and works. Making it the sole rendering path means the client never needs to know about file formats. This eliminates pdfjs-dist from the client bundle (~2MB) and simplifies the reader significantly.

**Alternative considered**: Format-aware client (pdfjs for PDF, `<img>` for archives). Rejected because it adds client complexity for no user benefit, and keeps the large pdfjs bundle.

**Trade-off**: PDFs can no longer be read before extraction completes. Acceptable because extraction happens eagerly at scan time and CBZ/CBR would have the same constraint anyway.

### 2. WASM-based CBR extraction via node-unrar-js

**Decision**: Use `node-unrar-js` for RAR extraction instead of requiring a system `unrar` binary.

**Rationale**: Zero system dependencies — works anywhere Node runs. The project already uses sharp (native) but avoiding additional native/system deps keeps deployment simple for a self-hosted app.

**Alternative considered**: System `unrar` binary (like the existing `pdftoppm` dependency for thumbnails). Rejected for portability — one fewer thing to install.

### 3. ZIP extraction via yauzl

**Decision**: Use `yauzl` for CBZ extraction.

**Rationale**: `yauzl` is the most robust async ZIP library for Node. It handles streaming extraction without loading the entire archive into memory, which matters for large CBZ files (100MB+). It correctly handles all ZIP features (ZIP64, different compression methods).

**Alternative considered**: `adm-zip` (simpler API but loads entire archive into memory), Node's built-in `zlib` (too low-level, no ZIP container support).

### 4. Natural sort for archive image ordering

**Decision**: Sort extracted images using natural/numeric sort on filenames.

**Rationale**: CBZ/CBR files contain images with varying naming conventions (`001.jpg`, `page_01.png`, `img-1.jpeg`, etc.). Natural sort ensures `page_2.jpg` comes before `page_10.jpg`. Filter out non-image files (thumbs.db, metadata, etc.) by extension.

### 5. Unified thumbnail generation from extracted pages

**Decision**: Generate thumbnails from the first extracted WebP page for all formats, replacing the current `pdftoppm`-based approach for PDFs.

**Rationale**: Once pages are extracted, thumbnails are just a resize of page 001. This removes the `pdftoppm` system dependency for thumbnails and unifies the code path. The thumbnail route can serve the first extracted page directly (or a resized version via sharp).

### 6. No DB schema migration needed

**Decision**: Don't add a `format` column to the volumes table. Dispatch by file extension at extraction time.

**Rationale**: The `filename` column already stores the full filename including extension. The extractor can check the extension to choose the extraction strategy. Adding a column would require a migration for zero practical benefit.

## Risks / Trade-offs

- **[Large CBR files + WASM performance]** → WASM-based unrar may be slower than native for very large archives (500MB+). Mitigation: This is a scan-time cost, not a read-time cost. Users won't notice.
- **[Image format variety in archives]** → Archives may contain JPEG, PNG, WebP, BMP, TIFF, or even non-image files. Mitigation: Filter by known image extensions, let sharp handle format conversion (it supports all common formats).
- **[Broken/partial archives]** → Corrupted or incomplete CBZ/CBR files. Mitigation: Extract what we can, set page_count to actual extracted count, log warnings for skipped files.
- **[Extraction-before-read requirement]** → PDFs previously readable without extraction. Mitigation: Extraction is fast enough for typical manga volumes (50-300 pages). Show "extracting" state in UI if volume isn't ready yet.
- **[Removing pdftoppm dependency]** → Thumbnail generation changes. Mitigation: Existing cached thumbnails remain valid. New thumbnails use extracted pages. Cleaner long-term.
