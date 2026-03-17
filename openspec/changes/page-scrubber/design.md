## Context

The manga reader has a bottom bar (`ReaderBottomBar.tsx`) that slides in/out with a 300ms transition, showing "Page X / Y" text. Navigation is limited to sequential methods (keyboard, swipe, tap zones, desktop arrow buttons). The bottom bar currently receives only `currentPage`, `totalPages`, and `spreadMode` — it has no access to the PDF document for rendering thumbnails.

The top bar and bottom bar visibility are controlled by a single `barsVisible` state in `MangaReader.tsx`.

## Goals / Non-Goals

**Goals:**
- Add a draggable scrub bar to the top edge of the bottom bar for quick page navigation
- Show a persistent thin progress line when bars are hidden
- Display page thumbnail + page number on scrub hover/drag
- Convert page indicator text into a scrollable page dropdown
- Keep the implementation lightweight with lazy thumbnail rendering

**Non-Goals:**
- Chapter/volume-level scrubbing (scrub bar is per-volume only)
- Thumbnail pre-rendering or pre-caching on PDF load
- Scrub bar in vertical scroll mode (vertical mode uses scroll position, not discrete pages)
- Page thumbnail quality tuning or zoom

## Decisions

### 1. Scrub bar as a child component inside ReaderBottomBar

The scrub bar (`PageScrubBar`) will be a new component rendered inside `ReaderBottomBar`, positioned absolutely at the top edge using `bottom-full` or negative top offset. This keeps the scrub bar visually connected to the bottom bar while being part of its DOM subtree, so it animates in/out together.

**Alternative considered:** Separate sibling component — rejected because it would require duplicating the show/hide transition logic and z-index coordination.

### 2. Persistent thin progress line as a separate element

When `barsVisible` is false, a thin 2-3px progress indicator renders at the very bottom of the screen. This is a separate simple div in `ReaderBottomBar` that is always visible (no translate-y transform), distinct from the full scrub bar that slides with the bottom bar.

**Alternative considered:** Keeping the scrub bar always visible and just shrinking it — rejected because the animation would be more complex and the thin line doesn't need interactivity.

### 3. Pass pdfDocument to ReaderBottomBar

`MangaReader.tsx` already holds the `pdfDocument` state. We'll pass it down to `ReaderBottomBar`, which passes it to the scrub bar for thumbnail rendering. The thumbnail cache will be a `useRef<Map<number, string>>()` inside the scrub bar component, storing data URLs keyed by page number.

**Alternative considered:** A shared thumbnail service/context — over-engineered for this use case. The scrub bar is the only consumer.

### 4. Thumbnail rendering approach: lazy with cache

On hover/drag over the scrub bar:
1. Calculate the hovered page number from mouse/touch X position
2. Check the `Map` cache for an existing data URL
3. If cached, show immediately in a tooltip above the cursor
4. If not cached, use `pdfDocument.getPage(pageNum)` → render to a small offscreen canvas (~150px wide) → `canvas.toDataURL()` → cache and display

The tooltip shows both the thumbnail image and "Page X" label below it.

### 5. Scrub bar interaction model

- **Mouse:** `onMouseDown` on the bar starts scrubbing. `onMouseMove` (on document) updates position. `onMouseUp` (on document) commits the page change.
- **Touch:** `onTouchStart`/`onTouchMove`/`onTouchEnd` with the same logic.
- **Click:** Single click on the bar jumps directly to that page.
- **Hover:** Shows thumbnail + page number tooltip without changing the current page.
- During drag, `onPageChange` is called on release (not continuously) to avoid excessive re-renders.

### 6. Page dropdown as a popover list

Clicking "Page X / Y" opens a scrollable list anchored above the bottom bar. The list auto-scrolls to center the current page on open. Clicking a page number calls `onPageChange` and closes the dropdown. Clicking outside or pressing Escape closes it.

## Risks / Trade-offs

- **[Thumbnail render delay]** → First hover on a page has ~50-100ms render delay. Mitigated by caching; most users scrub back and forth over nearby pages. A loading placeholder (gray box) shows during render.
- **[Memory from cached thumbnails]** → Each thumbnail data URL is ~5-15KB. Even caching all pages of a 200-page volume uses ~1-3MB. Acceptable for modern devices.
- **[Touch conflicts with swipe navigation]** → Scrub bar touch events must `stopPropagation` to prevent triggering the swipe-to-turn-page handler in `MangaReader`. The scrub bar is only interactive when bars are visible, so there's no conflict with the thin progress line.
- **[Spread mode complexity]** → In spread mode, the scrub bar still operates on individual pages. The page text in the dropdown reflects the spread ("Pages 3-4") but scrubbing jumps by single pages. This keeps the scrub bar simple.
