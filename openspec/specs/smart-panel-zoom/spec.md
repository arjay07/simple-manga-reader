# smart-panel-zoom Specification

## Purpose
TBD - created by archiving change panel-data-generation. Update Purpose after archive.
## Requirements
### Requirement: Smart panel zoom toggle
The manga reader SHALL provide a toggle to enable or disable smart panel zoom mode, persisted in localStorage.

#### Scenario: Toggle default state
- **WHEN** a user has never toggled smart panel zoom
- **THEN** the feature SHALL be disabled by default

#### Scenario: Toggle persisted
- **WHEN** a user enables smart panel zoom
- **THEN** the preference SHALL be saved to localStorage and persist across sessions

### Requirement: Panel data loading
When smart panel zoom is enabled, the reader SHALL fetch panel data for the current volume from `GET /api/panel-data/:volumeId` on volume load.

#### Scenario: Panel data available
- **WHEN** smart panel zoom is enabled and panel data exists for the volume
- **THEN** the reader SHALL load the panel data and enable panel-by-panel navigation

#### Scenario: Panel data not available
- **WHEN** smart panel zoom is enabled but no panel data exists for the volume
- **THEN** the reader SHALL fall back to normal page navigation and indicate that panel data is not available

#### Scenario: Partial panel data
- **WHEN** panel data exists for some but not all pages
- **THEN** the reader SHALL use panel zoom on pages that have data and fall back to normal navigation on pages without data

### Requirement: Panel-by-panel navigation
When smart panel zoom is active and panel data is available for the current page, tapping/clicking SHALL navigate to the next panel in reading order by zooming to that panel's bounding box.

#### Scenario: Navigate to next panel
- **WHEN** the user taps and there are more panels on the current page
- **THEN** the view SHALL zoom/pan to the next panel in reading order

#### Scenario: Last panel on page
- **WHEN** the user taps on the last panel of a page
- **THEN** the reader SHALL advance to the next page and zoom to the first panel

#### Scenario: Page with no panels (full-bleed/cover)
- **WHEN** the current page has `pageType` of "full-bleed", "cover", or "blank"
- **THEN** the reader SHALL display the full page without zooming and advance to the next page on tap

### Requirement: Pinch coexists with panel-by-panel navigation
When the user pinches while smart panel zoom is active, the reader SHALL adjust the zoom freely during the gesture without pausing panel-by-panel navigation. Subsequent swipes SHALL continue to navigate panel-by-panel. Only when the user pinches all the way out (final scale below the fit threshold) does the reader pause panel auto-zoom, matching the double-tap-out escape gesture.

#### Scenario: Pinch-in on a panel view adjusts zoom without pausing panels
- **WHEN** smart panel zoom is active and the reader is currently zoomed to a panel stop
- **AND** the user pinches to a final scale above the fit threshold
- **THEN** panel auto-zoom SHALL remain active (paused flag NOT set)
- **AND** the current panel index and stop SHALL be preserved

#### Scenario: Swipes after pinch-in advance to the next panel
- **WHEN** the user has pinched to a custom zoom on a panel and then swipes horizontally
- **THEN** the swipe SHALL advance or retreat by panel (not by page)
- **AND** the next panel SHALL be displayed at its computed panel zoom, transitioning smoothly from the user's pinched view

#### Scenario: Swipe after pinch interpolates from the pinched position
- **WHEN** the user swipes progressively from a pinched view while in panel mode
- **THEN** the drag preview SHALL interpolate from the live pinched transform (not the pristine panel transform) toward the target panel/stop

#### Scenario: Pinch-out to exit pauses panel mode
- **WHEN** the user pinches to a final scale below the fit threshold
- **THEN** the reader SHALL exit zoom to full page
- **AND** the panel-zoom paused flag SHALL be set (same behavior as double-tap-out)
- **AND** subsequent swipes SHALL navigate full pages

#### Scenario: Double-tapping a panel re-enters panel mode after pinch-out-exit
- **WHEN** panel mode was paused by pinch-out and the user double-taps on a panel
- **THEN** the reader SHALL clear the paused flag and zoom to the tapped panel (existing double-tap-panel behavior)

