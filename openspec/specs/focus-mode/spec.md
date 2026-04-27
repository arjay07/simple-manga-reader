# focus-mode Specification

## Purpose
TBD - created by archiving change add-focus-mode. Update Purpose after archive.
## Requirements
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

#### Scenario: Letterbox framing tracks the rendered panel

- **WHEN** the letterbox is visible
- **THEN** the revealed rect SHALL be the panel's padded bounding box (same 8% adaptive margin Smart Panel Zoom uses) projected through the wrapper's current transform, clamped to the viewport and pixel-rounded
- **AND** the rect SHALL encase the panel as it is actually rendered — on narrow/portrait viewports where multi-stop zoom enlarges the panel beyond its fit size, the rect grows to match; on wide viewports the rect fills viewport width with top/bottom bars matching the panel's visible vertical extent

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

The letterbox SHALL animate its framing rect smoothly during panel-to-panel transitions and user gestures, including cross-page panel transitions. When a transition is driven by a CSS animation on another element (e.g. the carousel strip's transform during a cross-page slide), the letterbox bar geometry SHALL transition with the same duration and easing curve as that driving animation, so the bars stay visually phase-locked to the panel they frame at every intermediate frame.

#### Scenario: Advance to next panel on the same page

- **WHEN** the user taps to advance from one panel to another on the same page
- **THEN** the letterbox edges SHALL animate from the previous padded rect to the new padded rect over approximately 200 ms with an ease-out curve

#### Scenario: Advance between stops of the same multi-stop panel

- **WHEN** the user taps to advance from one stop to another stop of the same panel
- **THEN** the letterbox frame SHALL remain visually stationary (every stop's clamped projected rect is identical because the panel's width at multi-stop zoom exceeds the viewport and its vertical extent is pan-invariant)
- **AND** the panel content underneath SHALL pan to the new stop

#### Scenario: Letterbox stays synced with the wrapper during panel-change animations

- **WHEN** the wrapper is animating its transform from one panel's position to the next over approximately 200 ms
- **THEN** the letterbox bars SHALL transition their geometry over the same duration and curve
- **AND** because the bar rect is a linear projection of the wrapper transform, the bars SHALL remain visually aligned with the moving panel throughout the animation (no dark coverage of content that has already entered the viewport)

#### Scenario: Cross-page letterbox morph stays phase-locked with the strip slide

- **WHEN** the carousel strip is animating across a page boundary as part of a cross-page panel transition (any input method — touch drag commit, keyboard, mouse wheel, tap-to-turn, arrow button)
- **THEN** the letterbox bar geometry SHALL transition with the same duration and easing curve as the strip's `transform` transition
- **AND** at every intermediate frame the bars SHALL frame the panel currently centered in the viewport, with no visible lead or lag relative to the panel's motion
- **AND** the previous behavior of using a hand-rolled cubic ease-out via a per-frame requestAnimationFrame loop SHALL no longer be used for cross-page letterbox morph

#### Scenario: Cross-page drag preview tracks the strip during a live touch drag

- **WHEN** the user is progressively dragging across a page boundary on touch (carousel strip translating with the finger)
- **THEN** the letterbox SHALL interpolate alongside the strip's translation each frame so the bars stay glued to whichever panel is currently centered in the viewport
- **AND** the bars SHALL NOT fade out during the drag

#### Scenario: Cross-page drag cancelled before commit

- **WHEN** a cross-page drag is released below the commit threshold and the carousel strip springs back to center
- **THEN** the letterbox SHALL spring back to fully frame the start panel of the current page using the same duration and easing curve as the strip's spring-back transition

#### Scenario: Cross-page drag committed

- **WHEN** a cross-page drag is released past the commit threshold and the strip finishes sliding to the neighbor slot
- **THEN** the letterbox SHALL settle on the to-rect (neighbor page's target panel) without a visible re-render snap after the strip transition completes

#### Scenario: Letterbox tracks pinch gestures

- **WHEN** the user pinches while the letterbox is visible and the final pinch scale remains above the fit threshold
- **THEN** the letterbox edges SHALL follow the live wrapper transform frame by frame with no visible lag

#### Scenario: Letterbox tracks within-page panel-drag preview

- **WHEN** the user swipes progressively between panels on the same page and the reader is rendering an interpolated preview transform
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

