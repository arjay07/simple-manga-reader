## ADDED Requirements

### Requirement: Top bar with back button, title, and settings
The reader SHALL display a top bar containing a back button (navigates to the series page), the volume/series title, and a settings gear icon. The top bar SHALL slide in from the top of the screen with a CSS transition.

#### Scenario: Top bar slides in on tap
- **WHEN** the user taps anywhere on the reader and bars are hidden
- **THEN** the top bar slides down into view from above the screen edge

#### Scenario: Top bar slides out on tap
- **WHEN** the user taps the center zone of the reader and bars are visible
- **THEN** the top bar slides up and out of view

#### Scenario: Back button navigates to series page
- **WHEN** the user taps the back button in the top bar
- **THEN** the browser navigates to `/library/[seriesId]`

#### Scenario: Settings gear opens settings modal
- **WHEN** the user taps the gear icon in the top bar
- **THEN** the settings modal opens and the tap does not toggle the bars

### Requirement: Bottom bar with page indicator
The reader SHALL display a bottom bar containing the current page indicator. The bottom bar SHALL slide in from the bottom of the screen with a CSS transition.

#### Scenario: Bottom bar shows current page in single mode
- **WHEN** the reader is in single page mode on page 5 of 180
- **THEN** the bottom bar displays "Page 5 / 180"

#### Scenario: Bottom bar shows current pages in spread mode
- **WHEN** the reader is in spread mode showing pages 5 and 6 of 180
- **THEN** the bottom bar displays "Pages 5-6 / 180"

#### Scenario: Bottom bar shows scroll progress in vertical mode
- **WHEN** the reader is in vertical scroll mode and page 5 is the most visible page
- **THEN** the bottom bar displays "Page 5 / 180"

### Requirement: Bars toggle together
The top bar and bottom bar SHALL always show and hide together as a single unit.

#### Scenario: Both bars appear simultaneously
- **WHEN** the user taps to show bars
- **THEN** both the top bar and bottom bar animate in at the same time

#### Scenario: Both bars hide simultaneously
- **WHEN** the user taps to hide bars
- **THEN** both the top bar and bottom bar animate out at the same time

### Requirement: Bars start hidden
The bars SHALL be hidden by default when the reader loads.

#### Scenario: Initial load
- **WHEN** the reader finishes loading a volume
- **THEN** both bars are hidden and the user sees only the manga page
