## Why

Smart panel zoom currently uses single-tap to advance through panels sequentially, with no way to go back to a previous panel or jump to a specific panel. This linear-only, tap-driven interaction feels unlike standard manga reader apps (which use swipe gestures) and lacks basic navigation like going backward. Double-tap currently does a generic point zoom unrelated to panels, which is confusing when panel data is available.

## What Changes

- **Double-tap on a panel** zooms into that specific panel (hit-test against panel bounding boxes); double-tap on non-panel areas does nothing; double-tap while zoomed exits panel zoom
- **Swipe in reading direction** (right for LTR, left for RTL) advances to the next panel with animated transition; at the last panel on a page, seamlessly transitions to the next page's first panel
- **Swipe against reading direction** retreats to the previous panel with animated transition; at the first panel on a page, seamlessly transitions to the previous page's last panel
- **Swipe-right on full page view** (LTR) enters the first panel of the current page instead of turning the page
- **Single tap** always toggles the toolbar in panel mode (no longer advances panels)
- Swipe directions respect RTL/LTR reading direction, consistent with existing carousel behavior

## Capabilities

### New Capabilities

- `panel-zoom-gestures`: Gesture-based panel navigation (swipe next/prev, double-tap to enter/exit panel zoom) replacing the current tap-to-advance model

### Modified Capabilities

- `smart-panel-zoom`: Panel navigation model changes from tap-to-advance to swipe-based with bidirectional navigation and double-tap entry/exit

## Impact

- `src/components/Reader/MangaReader.tsx` — touch handlers (`handleTouchEnd`, `handleTouchMove`), new `retreatPanel()` function mirroring `advancePanel()`, panel hit-testing on double-tap, gesture routing changes
- No API changes, no database changes, no new dependencies
- The 280ms single-tap delay can potentially be removed in panel mode since double-tap no longer conflicts with single-tap actions (both now have distinct purposes)
