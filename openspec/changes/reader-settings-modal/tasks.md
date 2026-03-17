## 1. Database & Settings Persistence

- [x] 1.1 Add `reader_settings TEXT DEFAULT '{}'` column to profiles table in `src/lib/db.ts`
- [x] 1.2 Define `ReaderSettings` type and `READER_DEFAULTS` constant in a new `src/lib/reader-settings.ts` util
- [x] 1.3 Update `/api/profiles/[id]` PUT handler to accept and persist `reader_settings` JSON
- [x] 1.4 Update `/api/profiles/[id]` GET handler to return `reader_settings` in the response
- [x] 1.5 Update `ProfileProvider` to include `reader_settings` in the Profile type and context

## 2. Reader Toolbar Bars

- [x] 2.1 Create `ReaderToolbar` component (top bar: back button, title, settings gear) with slide-in/out animation
- [x] 2.2 Create `ReaderBottomBar` component (page indicator) with slide-in/out animation
- [x] 2.3 Add `barsVisible` state to `MangaReader` and wire tap-to-toggle logic
- [x] 2.4 Remove the existing auto-hide overlay and spread mode toggle button from `MangaReader`
- [x] 2.5 Pass series/volume title info to the reader so the top bar can display it

## 3. Settings Modal

- [x] 3.1 Create `ReaderSettingsModal` component with backdrop and close behavior
- [x] 3.2 Add reading direction toggle (RTL / LTR / Vertical) to the modal
- [x] 3.3 Add tap-to-turn-page on/off toggle to the modal (hidden in vertical mode)
- [x] 3.4 Add page mode single/spread toggle to the modal (hidden on mobile and in vertical mode)
- [x] 3.5 Wire modal open/close to the gear icon in `ReaderToolbar`
- [x] 3.6 Apply settings changes immediately to reader state on toggle
- [x] 3.7 Debounced save of settings to `/api/profiles/[id]` on change

## 4. Tap-to-Turn Page

- [x] 4.1 Implement tap zone detection (left 25%, center 50%, right 25%) in `MangaReader`
- [x] 4.2 Wire tap zones to page navigation when tap-to-turn is enabled (direction-aware, zones flip in RTL)
- [x] 4.3 Ensure center zone always toggles bars regardless of tap-to-turn setting

## 5. Vertical Scroll Mode

- [x] 5.1 Create `VerticalScrollView` component that renders all pages as stacked canvases
- [x] 5.2 Scale each page canvas to fit container width with proportional height
- [x] 5.3 Track current page via `IntersectionObserver` on page canvases for progress saving
- [x] 5.4 Disable horizontal swipe and tap-to-turn in vertical mode
- [x] 5.5 Disable spread mode when vertical mode is selected

## 6. Refactor MangaReader Integration

- [x] 6.1 Update `MangaReader` to read settings from `reader_settings` JSON (with defaults merge) instead of `readingDirection` prop alone
- [x] 6.2 Conditionally render `PaginatedView` (existing canvas logic) vs `VerticalScrollView` based on direction setting
- [x] 6.3 Update reader page server component to pass `reader_settings` and volume title to `MangaReader`
- [x] 6.4 Verify keyboard navigation adapts correctly (arrows for paginated, up/down for vertical)
- [x] 6.5 Verify progress auto-save works in all three modes
