## 1. Placeholder Page Sizing

- [x] 1.1 On PDF load, measure page 1 aspect ratio and store it in a ref
- [x] 1.2 Set all canvas elements to placeholder dimensions (container width × computed height from aspect ratio) on mount
- [x] 1.3 Recalculate placeholder dimensions on window resize (using stored aspect ratio)

## 2. Lazy Rendering with IntersectionObserver

- [x] 2.1 Add an IntersectionObserver with rootMargin to detect pages entering/leaving a 3-page buffer zone
- [x] 2.2 Render pages to canvas when they enter the buffer zone
- [x] 2.3 Clear canvas content (but preserve placeholder dimensions) when pages leave the buffer zone
- [x] 2.4 Remove the existing render-all-on-mount useEffect

## 3. Resize Handling

- [x] 3.1 Replace the existing resize handler with a debounced version (300ms)
- [x] 3.2 On resize, re-render only pages currently within the buffer zone (not all pages)

## 4. PDF Response Caching

- [x] 4.1 Add `Cache-Control: private, max-age=86400` header to the PDF route response in `src/app/api/manga/[seriesId]/[volumeId]/pdf/route.ts`

## 5. Verification

- [ ] 5.1 Open a manga in vertical scroll mode and confirm first page appears in under 1 second
- [ ] 5.2 Scroll through the entire volume and confirm pages render smoothly as they enter the viewport
- [ ] 5.3 Confirm reading progress tracking still works correctly
- [x] 5.4 Verify `npm run build` succeeds with no errors
