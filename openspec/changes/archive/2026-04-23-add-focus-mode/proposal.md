## Why

When Smart Panel Zoom is active, the reader crops to a panel but adjacent panels and page gutters remain visible at the edges of the viewport — breaking the sense of focus. Focus Mode adds animated black letterbox bars around the current panel so the reader's eye stays on the panel being read.

## What Changes

- Add a new `Focus Mode` toggle in `ReaderSettingsModal`, rendered directly below the existing Smart Panel Zoom toggle.
- The toggle is only visible when Smart Panel Zoom is enabled and includes a short explanation (e.g., "Adds black bars around the current panel so nothing else distracts").
- Persist the preference in `localStorage` under `focusMode`, default `false`.
- When Focus Mode is on and the reader is zoomed to a panel, render four black overlay divs outside the panel's padded on-screen bounding box (top/bottom/left/right).
- Letterbox tracks the live wrapper transform during pinch and drag gestures so bars stay glued to the panel as the user manipulates zoom.
- Letterbox rect interpolates to the new panel on same-page advance/retreat using the same 200 ms ease-out cadence as the wrapper transition.
- Letterbox fades to 0 opacity during cross-page strip-slide transitions and fades back in when the new panel settles.
- Letterbox is hidden when Smart Panel Zoom is paused, when the page is `full-bleed` / `cover` / `blank`, or when Focus Mode itself is off.

## Capabilities

### New Capabilities

- `focus-mode`: Animated letterbox overlay that frames the current panel when Smart Panel Zoom is active, plus the associated UI toggle and persistence.

### Modified Capabilities

_(none — `smart-panel-zoom` requirements are unchanged; Focus Mode composes on top of existing panel-zoom behavior.)_

## Impact

- **Code**
  - `src/components/Reader/MangaReader.tsx` — new state (`focusMode`, `panelRectRef`), new overlay JSX, new callback passed to the settings modal; hooks into existing zoom/pinch/drag/strip-slide paths to publish the current padded panel rect and fade state.
  - `src/components/Reader/ReaderSettingsModal.tsx` — new `focusMode` / `onFocusModeChange` props and a conditional sub-toggle rendered when `smartPanelZoom` is on.
- **Storage**: new `localStorage` key `focusMode` (boolean string).
- **APIs / dependencies**: none.
- **Specs**: new `openspec/specs/focus-mode/spec.md` (created on archive).
