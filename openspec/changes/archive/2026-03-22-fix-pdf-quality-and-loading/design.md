## Context

The reader uses pdfjs-dist v5 to render PDF pages onto HTML `<canvas>` elements. Scale is computed from `container.clientWidth`/`clientHeight` — CSS logical pixels — without accounting for `window.devicePixelRatio`. On high-DPI displays (phones at DPR=3, Retina laptops at DPR=2) the canvas is undersized relative to the physical screen, producing blurry output.

Load time is bottlenecked by the PDF API route streaming the full file with a `200 OK` response and no `Accept-Ranges` or `Content-Length` headers. pdfjs-dist has range-request support built in and enabled by default (`disableRange: false`), but it requires the server to advertise and handle `Range` requests. Without this, pdfjs downloads the entire PDF before it can resolve page metadata — often 50–200MB for a manga volume.

## Goals / Non-Goals

**Goals:**
- Sharp rendering on all screen densities by applying DPR scaling to canvas dimensions
- Fast first-page render by enabling HTTP range requests on the PDF streaming route
- Instant page turns via background pre-render of the adjacent page

**Non-Goals:**
- Server-side PDF rasterization or thumbnail pre-generation at read time
- Caching `PDFDocumentProxy` across navigation (separate concern, not requested)
- Changing the PDF file format or storage layout

## Decisions

### DPR scaling pattern

**Decision**: Multiply the computed CSS scale by `window.devicePixelRatio`. Set the canvas `.width`/`.height` to the physical pixel dimensions. Set `canvas.style.width/height` to the CSS dimensions so layout is unaffected.

```
const dpr = window.devicePixelRatio || 1;
const scale = Math.min(scaleW, scaleH) * dpr;
const scaledViewport = page.getViewport({ scale });

canvas.width = scaledViewport.width;          // physical pixels
canvas.height = scaledViewport.height;
canvas.style.width = `${scaledViewport.width / dpr}px`;   // CSS pixels
canvas.style.height = `${scaledViewport.height / dpr}px`;
```

**Alternatives considered**:
- Canvas `context.scale(dpr, dpr)` with 2D transform — more fragile with pdfjs render internals; the viewport-multiplication approach is the pdfjs-recommended pattern.
- CSS `image-rendering: pixelated` — no effect on blurriness from under-sampling.

**Applied to**: `MangaReader.tsx:renderPage`, `VerticalScrollView.tsx:renderPage`, and the placeholder sizing in `VerticalScrollView.tsx`.

### HTTP range requests

**Decision**: Update `pdf/route.ts` to:
1. Always send `Accept-Ranges: bytes` and `Content-Length` (from `fs.stat()`)
2. Parse the `Range: bytes=X-Y` request header when present
3. Return `206 Partial Content` with `Content-Range: bytes X-Y/total` for range requests
4. Fall back to full `200` stream when no `Range` header is present

**Alternatives considered**:
- Serving PDFs via Next.js `public/` folder — requires copying all manga files into the repo; breaks the `MANGA_DIR` architecture.
- Using a CDN or object storage — out of scope, this is a self-hosted app.
- Setting `disableRange: true` in pdfjs — the opposite of what we want.

### Next-page pre-render

**Decision**: After `renderPage()` completes for the current page in paginated mode, render `currentPage + 1` (or `currentPage - 1` for RTL) into a hidden off-screen `<canvas>` held in a ref. On page turn, if the pre-rendered canvas matches the new target page, swap it in as a `ImageBitmap` (via `createImageBitmap`) drawn onto the visible canvas — instant display, then re-render at full quality asynchronously.

**Simpler alternative chosen**: Rather than the ImageBitmap swap complexity, render into a second off-screen canvas and simply call `drawImage` from it onto the visible canvas as a synchronous blit. The pre-render is low-priority; use a `requestIdleCallback` wrapper so it doesn't compete with the current page render.

## Risks / Trade-offs

- **Range request 206 implementation complexity** → The route handler needs careful byte-range parsing. Use a well-understood pattern (parse `bytes=X-Y`, clamp to file size, stream the slice with `createReadStream({ start, end })`). Cover edge cases: missing end byte (treat as EOF), invalid range (return `416`).
- **DPR scaling increases canvas memory** → At DPR=3, canvas pixel count is 9× larger. For a 1080×1920 canvas that's ~25MB per page. Acceptable for the paginated mode (2 pages max visible). In vertical scroll mode the buffer (3 pages) is bounded; this is fine.
- **Pre-render wastes work on fast readers** → If the user flips past the pre-rendered page before it finishes, the render is cancelled. Net cost: one extra `getPage()` call. Acceptable.
- **Pre-render in spread mode** → Pre-render page N+2 (the next spread's first page). Second page of the spread (N+3) can be rendered on turn since one page is already cached.

## Migration Plan

All changes are additive or drop-in replacements. No database changes, no API contract changes visible to clients (range request support is backward-compatible — clients without `Range` headers get the full `200` response as before). Deploy by rebuilding and restarting the Next.js server.
