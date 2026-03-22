## Why

PDF pages render at low resolution on high-DPI/mobile screens because `devicePixelRatio` is never applied during canvas rendering, and initial load times are long because the PDF API route doesn't support HTTP range requests, forcing pdfjs to download the entire file before rendering page 1.

## What Changes

- Apply `devicePixelRatio` scaling when rendering PDF pages to canvas in both paginated and vertical scroll modes
- Update the PDF streaming API route to support HTTP range requests (`Accept-Ranges`, `Content-Length`, `206 Partial Content`)
- Pre-render the next page in the background after the current page loads in paginated mode, so page turns feel instant

## Capabilities

### New Capabilities

- `pdf-rendering-quality`: High-DPI canvas rendering using `devicePixelRatio` so pages are sharp on all screens
- `pdf-range-requests`: HTTP range request support on the PDF API route so pdfjs can fetch only what it needs
- `pdf-page-prerender`: Background pre-rendering of the next page in paginated mode for instant page turns

### Modified Capabilities

## Impact

- `src/components/Reader/MangaReader.tsx` — `renderPage` function updated to apply DPR scaling; add next-page pre-render logic
- `src/components/Reader/VerticalScrollView.tsx` — `renderPage` function updated to apply DPR scaling
- `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts` — add `Accept-Ranges`, `Content-Length`, and `Range` header handling
