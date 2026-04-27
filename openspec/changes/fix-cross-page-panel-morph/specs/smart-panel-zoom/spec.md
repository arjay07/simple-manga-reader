## MODIFIED Requirements

### Requirement: Pinch coexists with panel-by-panel navigation

When the user pinches while smart panel zoom is active, the reader SHALL adjust the zoom freely during the gesture without pausing panel-by-panel navigation. Subsequent swipes SHALL continue to navigate panel-by-panel. Only when the user pinches all the way out (final scale below the fit threshold) does the reader pause panel auto-zoom, matching the double-tap-out escape gesture. Any drag preview that follows a pinch SHALL interpolate from the live wrapper transform — not a snapshot taken at touch-start — for both within-page and cross-page swipes.

#### Scenario: Pinch-in on a panel view adjusts zoom without pausing panels

- **WHEN** smart panel zoom is active and the reader is currently zoomed to a panel stop
- **AND** the user pinches to a final scale above the fit threshold
- **THEN** panel auto-zoom SHALL remain active (paused flag NOT set)
- **AND** the current panel index and stop SHALL be preserved

#### Scenario: Swipes after pinch advance to the next panel

- **WHEN** the user has pinched to a custom zoom on a panel and then swipes horizontally
- **THEN** the swipe SHALL advance or retreat by panel (not by page)
- **AND** the next panel SHALL be displayed at its computed panel zoom, transitioning smoothly from the user's pinched view

#### Scenario: Swipe after pinch interpolates from the live wrapper transform

- **WHEN** the user swipes progressively from a pinched view while in panel mode
- **THEN** the drag preview SHALL interpolate from the live wrapper transform (read from `zoomOriginRef` / `zoomScaleRef` / `panRef` at the moment the preview is computed), not from a snapshot of the wrapper transform taken at touch-start
- **AND** this SHALL apply identically to within-page swipes (advancing/retreating between panels of the current page) and cross-page swipes (commit and cancel branches of touch drags that cross a page boundary, and the in-flight cross-page drag preview frame computation)
- **AND** the keyboard, mouse-wheel, tap-to-turn, and arrow-button cross-page slide path SHALL continue to read the live wrapper transform when constructing its `fromTransform`, as it does today

#### Scenario: Pinch-out to exit pauses panel mode

- **WHEN** the user pinches to a final scale below the fit threshold
- **THEN** the reader SHALL exit zoom to full page
- **AND** the panel-zoom paused flag SHALL be set (same behavior as double-tap-out)
- **AND** subsequent swipes SHALL navigate full pages

#### Scenario: Double-tapping a panel re-enters panel mode after pinch-out-exit

- **WHEN** panel mode was paused by pinch-out and the user double-taps on a panel
- **THEN** the reader SHALL clear the paused flag and zoom to the tapped panel (existing double-tap-panel behavior)
