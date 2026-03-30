## ADDED Requirements

### Requirement: Double-tap panel entry
When smart panel zoom is active and the user double-taps on a page, the reader SHALL hit-test the tap point against panel bounding boxes. If the tap lands within a panel (including its 15% margin), the reader SHALL zoom into that specific panel. If the tap does not land on any panel, the double-tap SHALL be ignored.

#### Scenario: Double-tap on a panel
- **WHEN** the user double-taps on an area that falls within a panel's bounding box (with 15% margin)
- **THEN** the reader SHALL zoom into that panel and set the current panel index to the matched panel

#### Scenario: Double-tap on gutter/non-panel area
- **WHEN** the user double-taps on an area that does not fall within any panel's bounding box
- **THEN** the reader SHALL take no action (no zoom, no navigation)

#### Scenario: Double-tap while zoomed into a panel
- **WHEN** the user double-taps while already zoomed into a panel
- **THEN** the reader SHALL exit panel zoom and return to full page view

### Requirement: Swipe panel navigation
When smart panel zoom is active and the user is zoomed into a panel, swiping SHALL navigate between panels instead of panning or turning pages.

#### Scenario: Swipe forward to next panel
- **WHEN** the user swipes in the reading direction (right for LTR, left for RTL) while zoomed into a panel
- **THEN** the reader SHALL animate to the next panel in reading order on the current page

#### Scenario: Swipe backward to previous panel
- **WHEN** the user swipes against the reading direction while zoomed into a panel
- **THEN** the reader SHALL animate to the previous panel in reading order on the current page

#### Scenario: Swipe forward past last panel on page
- **WHEN** the user swipes forward on the last panel of a page and a next page exists with panel data
- **THEN** the reader SHALL seamlessly transition to the next page's first panel with carousel slide animation

#### Scenario: Swipe backward past first panel on page
- **WHEN** the user swipes backward on the first panel of a page and a previous page exists with panel data
- **THEN** the reader SHALL seamlessly transition to the previous page's last panel with carousel slide animation

#### Scenario: Swipe forward on last page last panel
- **WHEN** the user swipes forward on the last panel of the last page in the volume
- **THEN** the reader SHALL exit panel zoom and fall through to normal end-of-volume behavior

#### Scenario: Swipe backward on first page first panel
- **WHEN** the user swipes backward on the first panel of the first page in the volume
- **THEN** the reader SHALL exit panel zoom and fall through to normal start-of-volume behavior

### Requirement: Swipe entry from full page view
When smart panel zoom is active and the user is viewing a page at full zoom (not zoomed into a panel), swiping in the reading direction SHALL enter panel zoom on the first panel.

#### Scenario: Swipe forward on full page view
- **WHEN** the user swipes in the reading direction while viewing a full page with panel data available
- **THEN** the reader SHALL zoom into the first panel of the current page

#### Scenario: Swipe backward on full page view
- **WHEN** the user swipes against the reading direction while viewing a full page
- **THEN** the reader SHALL perform normal page navigation (carousel page turn)

### Requirement: RTL-aware swipe directions
Swipe directions for panel navigation SHALL respect the reading direction setting, consistent with existing carousel behavior.

#### Scenario: LTR swipe mapping
- **WHEN** reading direction is LTR
- **THEN** swipe right SHALL mean "next panel" and swipe left SHALL mean "previous panel"

#### Scenario: RTL swipe mapping
- **WHEN** reading direction is RTL
- **THEN** swipe left SHALL mean "next panel" and swipe right SHALL mean "previous panel"

### Requirement: Single tap in panel mode
When smart panel zoom is active, single tap SHALL always toggle the toolbar visibility regardless of zoom state.

#### Scenario: Single tap while zoomed into panel
- **WHEN** the user single-taps while zoomed into a panel
- **THEN** the reader SHALL toggle toolbar visibility and SHALL NOT advance to the next panel

#### Scenario: Single tap on full page view
- **WHEN** the user single-taps while viewing a full page with smart panel zoom active
- **THEN** the reader SHALL toggle toolbar visibility and SHALL NOT enter panel zoom
