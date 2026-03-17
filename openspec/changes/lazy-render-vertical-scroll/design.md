## Context

The vertical scroll view (`VerticalScrollView.tsx`) currently renders every page of a PDF on mount. For a 180-page manga, this means 180 sequential canvas render operations before the user sees anything, resulting in ~11 second load times. The paginated and spread modes are unaffected — they only render 1-2 pages at a time.

The PDF delivery endpoint (`pdf/route.ts`) returns no caching headers, so every open of the same volume triggers a full file stream from disk even within the same browser session.

## Goals / Non-Goals

**Goals:**
- Reduce perceived load time in vertical scroll mode from ~11s to <1s
- Maintain smooth scrolling experience with pre-rendered buffer pages
- Cache PDF responses in the browser to make repeat opens instant
- Keep scrollbar position and behavior correct with placeholder heights

**Non-Goals:**
- HTTP range requests / streaming PDF loading (complexity not justified for LAN use)
- Server-side page-to-image extraction pipeline
- Changes to paginated or spread reading modes
- Preloading or prefetching adjacent volumes

## Decisions

### 1. IntersectionObserver for viewport-aware rendering

**Choice**: Use IntersectionObserver with a root margin to detect pages entering/leaving a buffer zone around the viewport.

**Why over scroll-position calculation**: IntersectionObserver is already used in the component for page tracking, is more performant (no scroll event listeners), and handles edge cases like container resizing natively.

**Buffer size**: 3 pages above and below the viewport. This gives ~6 pages of buffer which covers fast scrolling without excessive memory use.

### 2. First-page aspect ratio for placeholder sizing

**Choice**: Render page 1 first, measure its aspect ratio, and apply that ratio to all placeholder canvases using the container width.

**Alternative considered**: Fixed hardcoded height — rejected because manga pages vary in aspect ratio between series, even if pages within a series are uniform. Using page 1's actual ratio is accurate for 99% of manga.

**Alternative considered**: Query each page's viewport without rendering — this would require `pdfDocument.getPage(n).getViewport()` for every page on mount, which is slow for large documents. The uniform-ratio assumption is good enough.

### 3. Render/unrender lifecycle

**Choice**: Pages entering the buffer zone get rendered to their canvas. Pages leaving the buffer zone get their canvas cleared (set width/height to placeholder dimensions, clear context) to free GPU memory.

**Why clear instead of destroy**: Canvases remain in the DOM for correct scroll positioning. We just clear their rendered content and reset dimensions to placeholder size.

### 4. Debounced resize re-rendering

**Choice**: Debounce the resize handler (300ms) and only re-render pages currently in the buffer, not all pages.

### 5. Cache-Control on PDF endpoint

**Choice**: `Cache-Control: private, max-age=86400` (24 hours). Private because PDFs may be user-specific content paths. 24 hours matches the existing cover image caching strategy.

## Risks / Trade-offs

- **[Blank flash on fast scroll]** → Users scrolling very fast may see blank placeholders before pages render. The 3-page buffer mitigates this. Could increase buffer if reported as an issue.
- **[Non-uniform page sizes]** → If a manga has mixed page dimensions (e.g. color inserts), placeholder heights will be slightly wrong for those pages. This causes a small scroll jump when the page renders at its true size. Acceptable for the rare case.
- **[Stale PDF cache]** → If a PDF file is replaced on disk with the same name, the browser serves the old version for up to 24 hours. Users can hard-refresh to bypass. Acceptable for a self-hosted tool.
