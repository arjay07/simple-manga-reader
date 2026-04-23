## ADDED Requirements

### Requirement: Focus Mode toggle

The manga reader SHALL provide a toggle to enable or disable Focus Mode, persisted in `localStorage` under the key `focusMode`.

#### Scenario: Toggle default state

- **WHEN** a user has never toggled Focus Mode
- **THEN** Focus Mode SHALL be disabled by default

#### Scenario: Toggle persisted

- **WHEN** a user enables Focus Mode
- **THEN** the preference SHALL be saved to `localStorage` and persist across sessions

#### Scenario: Toggle visibility gated by Smart Panel Zoom

- **WHEN** Smart Panel Zoom is disabled in the settings modal
- **THEN** the Focus Mode toggle SHALL NOT be rendered in the settings modal

#### Scenario: Toggle visible when Smart Panel Zoom is enabled

- **WHEN** Smart Panel Zoom is enabled in the settings modal
- **THEN** the Focus Mode toggle SHALL appear directly below the Smart Panel Zoom toggle
- **AND** a short explanatory helper line SHALL describe what Focus Mode does

#### Scenario: Preference survives toggling Smart Panel Zoom off

- **WHEN** Focus Mode is on and the user turns Smart Panel Zoom off
- **THEN** the `focusMode` preference in `localStorage` SHALL remain `true`
- **AND** when Smart Panel Zoom is later re-enabled, Focus Mode SHALL be active again without a second tap

### Requirement: Letterbox activation

When Focus Mode and Smart Panel Zoom are both enabled and the reader is zoomed to a panel, the reader SHALL display a black letterbox overlay that frames the padded bounding box of the current panel.

#### Scenario: Letterbox visible while zoomed to a panel

- **WHEN** Focus Mode is on, Smart Panel Zoom is on, and the reader is currently zoomed to a panel stop on a page with `pageType === 'panels'`
- **THEN** four black overlay regions SHALL cover the viewport area outside the current panel's padded rect
- **AND** the covered regions SHALL be opaque black

#### Scenario: Letterbox framing matches the panel's natural aspect ratio

- **WHEN** the letterbox is visible and no live gesture (pinch/drag) is in progress
- **THEN** the revealed rect SHALL be sized by the panel's padded bounding box (same 8% adaptive margin Smart Panel Zoom uses) at its fit-to-viewport aspect ratio, centered in the viewport
- **AND** the entire detected panel (plus adaptive margin) SHALL be fully revealed by the rect regardless of current multi-stop zoom
- **AND** on wide screens the rect SHALL NOT collapse into a square — a wide panel produces a wide strip, a tall panel produces a tall strip

#### Scenario: Letterbox hidden when not zoomed

- **WHEN** the reader is displaying a full page without panel zoom active
- **THEN** no letterbox overlay SHALL be rendered

#### Scenario: Letterbox hidden on non-panel pages

- **WHEN** the current page has `pageType` of `full-bleed`, `cover`, or `blank`
- **THEN** no letterbox overlay SHALL be rendered, even if Focus Mode is on

#### Scenario: Letterbox hidden when Focus Mode is off

- **WHEN** Focus Mode is off
- **THEN** no letterbox overlay SHALL be rendered regardless of zoom state

#### Scenario: Letterbox hidden when panel zoom is paused

- **WHEN** the user has double-tapped out or pinched out past the fit threshold so Smart Panel Zoom is paused (`panelZoomPausedRef === true`)
- **THEN** the letterbox SHALL NOT be rendered until panel zoom resumes

### Requirement: Letterbox animation on panel transitions

The letterbox SHALL animate its framing rect smoothly during panel-to-panel transitions and user gestures.

#### Scenario: Advance to next panel on the same page

- **WHEN** the user taps to advance from one panel to another on the same page
- **THEN** the letterbox edges SHALL animate from the previous padded rect to the new padded rect over approximately 200 ms with an ease-out curve

#### Scenario: Advance between stops of the same multi-stop panel

- **WHEN** the user taps to advance from one stop to another stop of the same panel
- **THEN** the letterbox frame SHALL remain stationary
- **AND** the panel content underneath SHALL pan to the new stop
- **AND** all stops of a given panel SHALL share the same focus window derived from the panel's fit-to-viewport aspect ratio (independent of multi-stop zoom level)

#### Scenario: Advance across a page boundary

- **WHEN** advancing to a panel on a different page triggers a cross-page strip-slide transition
- **THEN** the letterbox SHALL fade out before or during the slide
- **AND** the letterbox SHALL fade back in framing the new panel once the new page is settled

#### Scenario: Letterbox tracks pinch gestures

- **WHEN** the user pinches while the letterbox is visible and the final pinch scale remains above the fit threshold
- **THEN** the letterbox edges SHALL follow the live wrapper transform frame by frame with no visible lag

#### Scenario: Letterbox tracks panel-drag preview

- **WHEN** the user swipes progressively between panels and the reader is rendering an interpolated preview transform
- **THEN** the letterbox SHALL interpolate alongside the preview so it stays glued to the visible panel rect

#### Scenario: Fade on enter

- **WHEN** Focus Mode or Smart Panel Zoom is first turned on while the reader is already zoomed to a panel
- **THEN** the letterbox SHALL fade in from opacity 0 to full opacity over approximately 150 ms

#### Scenario: Fade on exit

- **WHEN** Focus Mode is turned off, Smart Panel Zoom is turned off, the user exits panel zoom to full page, or panel zoom becomes paused
- **THEN** the letterbox SHALL fade out to opacity 0 over approximately 150 ms before being removed

### Requirement: Letterbox consistency on viewport resize

When the viewport size changes while the letterbox is visible, the letterbox SHALL be recomputed so it continues to frame the current panel accurately.

#### Scenario: Window resized while zoomed

- **WHEN** the browser window is resized while the letterbox is visible
- **THEN** the letterbox rect SHALL be recomputed using the new viewport dimensions
- **AND** the letterbox SHALL continue to frame the current padded panel rect without a visible misalignment

### Requirement: Letterbox does not block interactive controls

The letterbox overlay SHALL NOT intercept pointer events that belong to the reader's existing controls (toolbar, bottom bar, arrow buttons, tap targets for panel navigation).

#### Scenario: Toolbar and bottom bar remain clickable

- **WHEN** the letterbox is visible and the reader toolbar or bottom bar is visible
- **THEN** buttons on the toolbar and bottom bar SHALL remain clickable

#### Scenario: Panel navigation taps still register

- **WHEN** the letterbox is visible and the user taps inside the viewport to advance or retreat between panels
- **THEN** the tap SHALL be handled by the reader's existing navigation logic, not absorbed by the overlay
