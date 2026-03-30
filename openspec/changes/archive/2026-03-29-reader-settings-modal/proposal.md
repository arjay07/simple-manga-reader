## Why

The manga reader currently has no in-reader UI for changing reading settings. Reading direction (RTL/LTR) is set at the profile level with no way to adjust it while reading. There's no vertical scroll mode (needed for manhwa/webtoons), no tap-to-turn-page option, and the page overlay auto-hides on a timer with no persistent controls. Users need a settings modal and proper toolbar bars to configure their reading experience per-profile without leaving the reader.

## What Changes

- **Reader toolbar bars**: Replace the current auto-hiding overlay with a top bar and bottom bar that slide in/out on tap. Top bar: back button, volume/series title, settings gear. Bottom bar: page indicator and navigation.
- **Settings modal**: Gear icon in the top bar opens a modal with all reader preferences.
- **Reading direction setting**: Expand from RTL/LTR to also include vertical scroll mode. Swipe and keyboard navigation adapt to the selected direction.
- **Vertical scroll mode**: New rendering mode that stacks pages vertically with native scroll, replacing paginated navigation.
- **Tap-to-turn-page setting**: Optional toggle. When enabled, tapping left/right edges of the screen turns pages (center tap still toggles bars). Direction-aware (zones flip in RTL).
- **Per-profile reader settings**: Add a `reader_settings` JSON column to the profiles table. All new settings stored here. Migrate existing `reading_direction` column into this blob.
- **Page mode setting**: Single/spread toggle moved into the settings modal (currently a floating button).

## Capabilities

### New Capabilities
- `reader-toolbar`: Top and bottom bars with slide-in/out animation, triggered by tap. Contains navigation, title, and settings access.
- `reader-settings-modal`: Modal UI for configuring reader preferences (direction, tap-to-turn, page mode).
- `vertical-scroll-mode`: Vertical continuous scroll rendering mode as an alternative to paginated reading.
- `reader-settings-persistence`: JSON-based per-profile reader settings stored in the database, replacing individual columns.

### Modified Capabilities

## Impact

- **Database**: New `reader_settings` TEXT column on `profiles` table. Migration of `reading_direction` data into JSON blob.
- **Components**: `MangaReader.tsx` — major refactor to support three reading modes, new toolbar, tap zones. New components for toolbar bars, settings modal.
- **API**: `/api/profiles/[id]` — read/write `reader_settings` JSON. Reader page server component updated to pass full settings.
- **State management**: `ProfileProvider` context expanded to include reader settings with defaults/merge logic.
