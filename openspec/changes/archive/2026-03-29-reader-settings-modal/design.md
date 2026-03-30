## Context

The manga reader currently uses a timed auto-hide overlay for page indication and a floating button for spread mode toggle. Reading direction is stored as a dedicated column (`reading_direction`) on the `profiles` table and can only be changed outside the reader. There is no vertical scroll mode, no tap-to-turn-page, and no in-reader settings UI.

The `MangaReader` component handles all rendering (canvas-based via pdfjs-dist), navigation (keyboard + swipe), and progress saving. The `ProfileProvider` context supplies the active profile including `reading_direction`.

## Goals / Non-Goals

**Goals:**
- Add slide-in/out top and bottom bars toggled by tap
- Add a settings modal accessible from the top bar's gear icon
- Support three reading modes: RTL paginated, LTR paginated, vertical scroll
- Add optional tap-to-turn-page with direction-aware edge zones
- Persist all reader settings per-profile in a JSON column
- Keep the reader feeling fast and responsive

**Non-Goals:**
- Zoom/pinch controls
- Brightness/contrast adjustments
- Per-series settings (all settings are per-profile for now)
- Page scrubber/slider in the bottom bar (can be added later)
- Virtualized rendering for vertical scroll (simple stacked render first)

## Decisions

### 1. JSON settings column over individual columns

Add `reader_settings TEXT DEFAULT '{}'` to the `profiles` table. All new reader preferences go here. The existing `reading_direction` column is kept for backward compatibility but the JSON blob is the source of truth when present.

**Rationale:** Reader settings will grow over time (gap size, fit mode, etc.). A JSON blob avoids repeated schema migrations. Settings are always read/written as a bundle, never queried individually.

**Alternative considered:** Individual columns — simpler to query but requires a migration for every new setting. Not worth it for UI-only preferences.

### 2. Settings defaults and merge pattern

Define a `READER_DEFAULTS` constant:

```ts
const READER_DEFAULTS = {
  readingDirection: 'rtl' as const,
  tapToTurn: false,
  pageMode: 'single' as const,
};
```

On load, merge: `{ ...READER_DEFAULTS, ...JSON.parse(profile.reader_settings || '{}') }`. This means unset keys always fall back to defaults, and new settings can be added without migration.

### 3. Toolbar bars replace the current overlay

The current auto-hide overlay (page indicator + spread toggle button) is removed entirely. Replaced by:

- **Top bar**: Back button (left), volume/series title (center), settings gear icon (right). Slides down from top.
- **Bottom bar**: Page indicator text. Slides up from bottom.

Both bars toggle together on tap. They start hidden after initial load. CSS transitions handle the slide animation (`transform: translateY`).

### 4. Tap interaction model

When bars are visible, tapping the center area hides them. When bars are hidden:

- **Tap-to-turn OFF (default):** Tap anywhere toggles bars.
- **Tap-to-turn ON:** Tap left 25% = prev/next (direction-aware), tap right 25% = next/prev (direction-aware), tap center 50% = toggle bars.

Swiping always works regardless of tap-to-turn setting. Tap zones flip in RTL mode.

### 5. Vertical scroll mode rendering

When `readingDirection` is `'vertical'`, the component switches from canvas-based paginated rendering to a scrollable container of stacked canvases. Each visible page is rendered to its own canvas.

Initial implementation renders all pages (simple approach). Performance optimization (virtualization) is a non-goal for v1 — most manga volumes are 20-40 pages which is manageable.

In vertical mode: swipe left/right and tap-to-turn are disabled. Keyboard up/down scrolls. Progress is tracked by calculating which page is most visible in the viewport via `IntersectionObserver`.

### 6. Settings modal design

Opened by the gear icon in the top bar. Click/tap outside or X button closes it. Overlays the reader with a semi-transparent backdrop.

Contents:
- **Reading Direction**: Three-option toggle — RTL / LTR / Vertical
- **Tap to Turn Page**: On/Off toggle
- **Page Mode**: Single / Spread toggle (only shown on desktop, only when not in vertical mode)

Changes apply immediately (no save button). Settings are persisted to the API on change (debounced).

### 7. Component structure

```
MangaReader (refactored)
├── ReaderToolbar (top bar)
│   ├── Back button
│   ├── Title
│   └── Settings gear button
├── ReaderBottomBar (bottom bar)
│   └── Page indicator
├── ReaderSettingsModal
│   ├── Direction toggle (RTL/LTR/Vertical)
│   ├── Tap-to-turn toggle
│   └── Page mode toggle
├── PaginatedView (RTL/LTR mode)
│   └── Canvas rendering (existing logic)
└── VerticalScrollView (vertical mode)
    └── Stacked canvas rendering
```

### 8. Settings persistence flow

```
User changes setting in modal
  → Update local React state immediately (instant feedback)
  → Debounced PUT to /api/profiles/[id] with updated reader_settings JSON
  → ProfileProvider context updated so other components see the change
```

The reader page server component passes initial settings from the DB. The client component can override them as the user changes settings in the modal.

## Risks / Trade-offs

**[Vertical scroll memory usage]** → Rendering all pages at once could be heavy for very long volumes (200+ pages). Mitigated by: most manga volumes are 20-40 pages; virtualization can be added later as an optimization pass.

**[Two sources of truth for reading_direction]** → The old `reading_direction` column and the new JSON blob could diverge. Mitigated by: JSON blob takes precedence; old column serves as fallback for profiles that haven't used the new settings yet.

**[Tap zone conflicts]** → Users might accidentally turn pages when trying to toggle bars. Mitigated by: tap-to-turn is off by default; center zone is generous (50%); swipe remains the primary navigation method.
