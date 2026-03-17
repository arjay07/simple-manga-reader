## Why

Vertical scroll mode renders all pages on mount, causing ~11 second load times for a single manga volume. Users must wait for every page to decode before seeing any content, even though only 1-2 pages are visible at a time.

## What Changes

- **Lazy page rendering**: Only render pages near the current viewport (visible + 3 pages buffer in each direction). Pages outside the buffer are replaced with correctly-sized placeholders.
- **Placeholder page heights**: Unrendered pages get estimated dimensions based on the first page's aspect ratio, so the scrollbar behaves correctly and scroll position is stable.
- **PDF response caching**: Add `Cache-Control` headers to the PDF streaming endpoint so repeat opens of the same volume are served from browser cache.

## Capabilities

### New Capabilities
- `lazy-page-rendering`: Viewport-aware lazy rendering for vertical scroll mode with IntersectionObserver-based page loading and unloading, placeholder sizing, and debounced resize handling.
- `pdf-response-caching`: HTTP cache headers on the PDF delivery endpoint for browser-level caching of previously loaded volumes.

### Modified Capabilities

_None — these are additive changes to existing components._

## Impact

- `src/components/Reader/VerticalScrollView.tsx` — Major rewrite: replace render-all-on-mount with IntersectionObserver-driven lazy rendering and placeholder heights.
- `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts` — Add `Cache-Control` response header.
- No new dependencies required. No API contract changes. No database changes.
