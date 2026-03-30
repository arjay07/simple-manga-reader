## ADDED Requirements

### Requirement: Multi-stop pan for wide panels
When a panel is wider than the viewport at height-fit zoom, the reader SHALL split it into multiple horizontal pan stops (maximum 3). Each swipe SHALL advance to the next stop before moving to the next panel.

#### Scenario: Wide panel with 2 stops
- **WHEN** a panel's width at height-fit zoom spans between 1x and 2x the viewport width
- **THEN** the reader SHALL split the panel into 2 stops with ~15% overlap between adjacent stops

#### Scenario: Wide panel with 3 stops
- **WHEN** a panel's width at height-fit zoom spans between 2x and 3x the viewport width
- **THEN** the reader SHALL split the panel into 3 stops with ~15% overlap between adjacent stops

#### Scenario: Very wide panel capped at 3 stops
- **WHEN** a panel's width at height-fit zoom would require more than 3 stops
- **THEN** the reader SHALL reduce the zoom level so the panel fits in exactly 3 stops

#### Scenario: Narrow panel unchanged
- **WHEN** a panel fits within the viewport at its natural zoom (single stop)
- **THEN** the reader SHALL use the existing fit-panel behavior with no multi-stop panning

### Requirement: Stop-aware swipe navigation
When zoomed into a multi-stop panel, swiping SHALL advance through stops before moving to the next panel.

#### Scenario: Swipe forward within multi-stop panel
- **WHEN** the user swipes forward while on a stop that is not the last stop of the current panel
- **THEN** the reader SHALL pan to the next stop within the same panel

#### Scenario: Swipe forward on last stop
- **WHEN** the user swipes forward on the last stop of a multi-stop panel
- **THEN** the reader SHALL advance to the next panel (or next page's first panel if last panel on page)

#### Scenario: Swipe backward within multi-stop panel
- **WHEN** the user swipes backward while on a stop that is not the first stop of the current panel
- **THEN** the reader SHALL pan to the previous stop within the same panel

#### Scenario: Swipe backward on first stop
- **WHEN** the user swipes backward on the first stop of a multi-stop panel
- **THEN** the reader SHALL retreat to the previous panel's last stop (or previous page's last panel's last stop)

### Requirement: RTL-aware stop order
Stop order SHALL respect the reading direction. In RTL mode, the first stop in reading order SHALL be the rightmost portion of the panel.

#### Scenario: LTR stop order
- **WHEN** reading direction is LTR
- **THEN** stop 0 SHALL show the leftmost portion and subsequent stops SHALL pan rightward

#### Scenario: RTL stop order
- **WHEN** reading direction is RTL
- **THEN** stop 0 SHALL show the rightmost portion and subsequent stops SHALL pan leftward

### Requirement: Double-tap entry on wide panel
When the user double-taps on a wide panel with multiple stops, the reader SHALL always enter at the first stop in reading order.

#### Scenario: Double-tap entry at first stop
- **WHEN** the user double-taps on a wide panel that has multiple stops
- **THEN** the reader SHALL zoom in and display the first stop in reading order regardless of tap position

### Requirement: Cross-page stop awareness
When transitioning between pages during panel navigation, the reader SHALL compute the stop count for the target panel and position at the correct stop.

#### Scenario: Advance to next page wide panel
- **WHEN** the reader transitions to the next page's first panel and that panel is a multi-stop panel
- **THEN** the reader SHALL enter at stop 0 of the target panel

#### Scenario: Retreat to previous page wide panel
- **WHEN** the reader transitions to the previous page's last panel and that panel is a multi-stop panel
- **THEN** the reader SHALL enter at the last stop of the target panel
