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

