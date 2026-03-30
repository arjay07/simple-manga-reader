## 1. Scrub Bar Component

- [x] 1.1 Create `PageScrubBar` component with progress fill and draggable handle, positioned at top edge of bottom bar
- [x] 1.2 Implement click-to-jump: map click X position to page number and call `onPageChange`
- [x] 1.3 Implement mouse drag: `onMouseDown` starts scrub, document-level `onMouseMove` updates handle, `onMouseUp` commits page change
- [x] 1.4 Implement touch drag: `onTouchStart`/`onTouchMove`/`onTouchEnd` with same logic as mouse

## 2. Thumbnail Preview

- [x] 2.1 Create thumbnail tooltip component that renders above the scrub position showing a page thumbnail image and "Page X" label
- [x] 2.2 Implement lazy thumbnail rendering: use pdfjs `getPage()` → render to small offscreen canvas (~150px wide) → `toDataURL()` → cache in `useRef<Map<number, string>>()`
- [x] 2.3 Show gray placeholder while thumbnail renders, page number label always visible immediately

## 3. Persistent Progress Line

- [x] 3.1 Add thin (2-3px) always-visible progress line at the bottom of the screen that shows reading progress even when bars are hidden
- [x] 3.2 Ensure the thin line transitions smoothly with the full scrub bar appearing/disappearing

## 4. Page Selector Dropdown

- [x] 4.1 Convert "Page X / Y" text into a clickable button that toggles the dropdown
- [x] 4.2 Create scrollable page list dropdown anchored above the bottom bar with bounded max-height
- [x] 4.3 Auto-scroll to center the current page (highlighted) when dropdown opens
- [x] 4.4 Implement close on outside click and Escape key press

## 5. Integration

- [x] 5.1 Update `MangaReader.tsx` to pass `pdfDocument` and `onPageChange` callback to `ReaderBottomBar`
- [x] 5.2 Update `ReaderBottomBar` to compose the scrub bar, progress line, and page dropdown
- [x] 5.3 Ensure scrub bar touch events stop propagation to prevent swipe-to-turn conflicts
- [x] 5.4 Hide scrub bar and progress line in vertical scroll mode
- [x] 5.5 Verify build compiles and test all interactions (click, drag, hover, dropdown) in browser
