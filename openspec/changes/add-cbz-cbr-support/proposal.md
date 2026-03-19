## Why

The reader currently only supports PDF files. CBZ (ZIP of images) and CBR (RAR of images) are the two other dominant manga/comic formats. Supporting them makes the reader useful for a much wider range of manga libraries without requiring users to convert their files.

## What Changes

- Scanner (`scanner.ts`) accepts `.cbz` and `.cbr` files alongside `.pdf`
- Extractor (`extractor.ts`) gains format-aware extraction: CBZ via ZIP library, CBR via WASM-based unrar
- **BREAKING**: Reader switches from client-side pdfjs rendering to pre-extracted WebP pages for ALL formats (including PDF). The `/api/.../pdf` streaming endpoint is removed or repurposed as download-only.
- Client-side `pdfjs-dist` dependency removed from browser bundle (kept server-side for PDF extraction)
- `MangaReader.tsx` renders `<img>` elements from `/api/.../page/N` instead of using pdfjs canvas rendering
- Thumbnail generation unified: all formats use first extracted page instead of format-specific tools

## Capabilities

### New Capabilities
- `cbz-extraction`: Extract pages from CBZ (ZIP) archives, sort images naturally, convert to WebP via sharp
- `cbr-extraction`: Extract pages from CBR (RAR) archives using WASM-based unrar, sort images naturally, convert to WebP via sharp
- `unified-page-rendering`: Reader uses pre-extracted WebP pages for all formats, removing client-side format awareness and pdfjs browser dependency

### Modified Capabilities
_(none — existing specs cover progress/navigation which are format-agnostic)_

## Impact

- **Code**: `scanner.ts`, `extractor.ts`, `MangaReader.tsx`, thumbnail route, PDF streaming route
- **Dependencies**: Add `yauzl` or `adm-zip` (CBZ), `node-unrar-js` (CBR). Remove `pdfjs-dist` from client bundle (keep in server dependencies).
- **APIs**: `/api/.../page/[pageNum]` becomes the sole rendering endpoint. `/api/.../pdf` either removed or kept as download-only.
- **UX**: Volumes cannot be read until extraction completes (current behavior for the page endpoint, but new constraint for PDFs which previously streamed directly). Extraction happens eagerly at scan time.
- **Data**: Existing extracted pages (`data/pages/`) remain valid. No DB migration needed — scanner already stores filename with extension, extractor dispatches by extension.
