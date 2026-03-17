## ADDED Requirements

### Requirement: Settings modal opens from gear icon
The reader SHALL display a settings modal when the user taps the gear icon in the top bar. The modal SHALL overlay the reader with a semi-transparent backdrop.

#### Scenario: Open settings modal
- **WHEN** the user taps the gear icon in the top bar
- **THEN** a modal appears with a backdrop overlay, containing reader preference controls

#### Scenario: Close settings modal via backdrop
- **WHEN** the user taps outside the modal content area
- **THEN** the modal closes

#### Scenario: Close settings modal via close button
- **WHEN** the user taps the X button in the modal
- **THEN** the modal closes

### Requirement: Reading direction setting
The settings modal SHALL provide a three-option toggle for reading direction: RTL, LTR, and Vertical.

#### Scenario: Switch to RTL
- **WHEN** the user selects RTL in the direction toggle
- **THEN** the reader immediately switches to right-to-left paginated mode with swipe left advancing to the next page

#### Scenario: Switch to LTR
- **WHEN** the user selects LTR in the direction toggle
- **THEN** the reader immediately switches to left-to-right paginated mode with swipe right advancing to the next page

#### Scenario: Switch to Vertical
- **WHEN** the user selects Vertical in the direction toggle
- **THEN** the reader immediately switches to vertical scroll mode with all pages stacked vertically

### Requirement: Tap-to-turn-page setting
The settings modal SHALL provide an on/off toggle for tap-to-turn-page. Default is off.

#### Scenario: Enable tap-to-turn
- **WHEN** the user enables the tap-to-turn toggle
- **THEN** tapping the left/right 25% edge zones of the screen turns pages (direction-aware) and tapping the center 50% toggles bars

#### Scenario: Disable tap-to-turn
- **WHEN** the user disables the tap-to-turn toggle
- **THEN** tapping anywhere on the reader toggles the bars and page turning is only available via swiping or keyboard

#### Scenario: Tap zones flip in RTL mode
- **WHEN** tap-to-turn is enabled and reading direction is RTL
- **THEN** tapping the right edge goes to the previous page and tapping the left edge goes to the next page

#### Scenario: Tap-to-turn disabled in vertical mode
- **WHEN** the reading direction is set to Vertical
- **THEN** the tap-to-turn toggle is hidden or disabled in the modal

### Requirement: Page mode setting
The settings modal SHALL provide a single/spread toggle for page mode, visible only on desktop viewports and only when not in vertical scroll mode.

#### Scenario: Switch to spread mode on desktop
- **WHEN** the user selects spread mode on a viewport wider than 1024px
- **THEN** the reader displays two pages side by side

#### Scenario: Page mode hidden on mobile
- **WHEN** the viewport is 1024px or narrower
- **THEN** the page mode toggle is not visible in the settings modal

#### Scenario: Page mode hidden in vertical mode
- **WHEN** the reading direction is set to Vertical
- **THEN** the page mode toggle is not visible in the settings modal

### Requirement: Settings apply immediately
All setting changes in the modal SHALL take effect immediately without a save button.

#### Scenario: Immediate application
- **WHEN** the user changes any setting in the modal
- **THEN** the reader behavior updates immediately while the modal remains open
