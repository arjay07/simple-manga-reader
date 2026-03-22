## 1. DPR Scaling — MangaReader (Paginated Mode)

- [x] 1.1 In `MangaReader.tsx:renderPage`, read `window.devicePixelRatio` and multiply the computed `scale` by it
- [x] 1.2 After computing `scaledViewport`, set `canvas.style.width` and `canvas.style.height` to the CSS pixel dimensions (`scaledViewport.width / dpr` and `scaledViewport.height / dpr`)
- [x] 1.3 Verify canvas `.width` / `.height` (physical pixels) and `style.width/height` (CSS pixels) are correct; confirm no layout shift

## 2. DPR Scaling — VerticalScrollView (Scroll Mode)

- [x] 2.1 In `VerticalScrollView.tsx:renderPage`, read `window.devicePixelRatio` and multiply `scale` by it
- [x] 2.2 Set `canvas.style.width` to `scaledViewport.width / dpr` px and `canvas.style.height` to `scaledViewport.height / dpr` px (keep existing `.width`/`.height` as physical pixels)
- [x] 2.3 In `applyPlaceholderSizes` and `clearPage`, ensure placeholder `style.width/height` use CSS pixels (not physical pixels) so scroll layout is unaffected

## 3. HTTP Range Requests — PDF API Route

- [x] 3.1 In `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts`, use `fs.stat()` to get the file size and add `Accept-Ranges: bytes` and `Content-Length` headers to all responses
- [x] 3.2 Parse the `Range` request header; if absent, return the existing full `200` stream (with the new headers added)
- [x] 3.3 For a valid `Range: bytes=X-Y` request, open a `createReadStream({ start: X, end: Y })` and return `206 Partial Content` with `Content-Range: bytes X-Y/<total>` and `Content-Length: Y-X+1`
- [x] 3.4 Handle open-ended ranges (`bytes=X-`) by treating the end as `fileSize - 1`
- [x] 3.5 Return `416 Range Not Satisfiable` with `Content-Range: bytes */<total>` when the start byte exceeds the file size

## 4. Next-Page Pre-render — Paginated Mode

- [x] 4.1 Add an `offscreenCanvasRef` and `prerenderedPageRef` (tracks which page is pre-rendered) and `prerenderTaskRef` (for cancellation) to `MangaReader.tsx`
- [x] 4.2 After `renderPage()` resolves in paginated single-page mode, use `requestIdleCallback` (with a `setTimeout` fallback) to render the next logical page (direction-aware: `currentPage - 1` for RTL, `currentPage + 1` for LTR) onto the offscreen canvas
- [x] 4.3 Skip pre-render when in spread mode or when the next page index is out of bounds
- [x] 4.4 On page turn, check if `prerenderedPageRef.current === newPage`; if so, `drawImage` from the offscreen canvas onto the visible canvas immediately, then fire a full-quality re-render asynchronously
- [x] 4.5 Cancel any in-progress pre-render task when the current page changes (call `prerenderTaskRef.current.cancel()` and cancel any pending `requestIdleCallback`)
