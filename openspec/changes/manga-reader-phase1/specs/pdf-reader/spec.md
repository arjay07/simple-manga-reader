## ADDED Requirements

### Requirement: Render PDF pages in-browser
The system SHALL render manga PDF pages using pdf.js in the browser without requiring server-side conversion.

#### Scenario: Opening a volume
- **WHEN** user navigates to a volume's reader URL
- **THEN** the system loads the PDF and displays the first page (or the user's last-read page if progress exists)

#### Scenario: Page renders correctly
- **WHEN** a PDF page is rendered
- **THEN** it SHALL be displayed at full quality, scaled to fit the viewport width on mobile or the viewport height on desktop

### Requirement: Single-page navigation
The system SHALL support page-by-page navigation through a manga volume.

#### Scenario: Next page via swipe
- **WHEN** user swipes left (in RTL mode) or right (in LTR mode)
- **THEN** the reader advances to the next page

#### Scenario: Previous page via swipe
- **WHEN** user swipes right (in RTL mode) or left (in LTR mode)
- **THEN** the reader goes to the previous page

#### Scenario: Keyboard navigation
- **WHEN** user presses the left/right arrow keys
- **THEN** the reader navigates pages according to the current reading direction

#### Scenario: First page boundary
- **WHEN** user attempts to go before the first page
- **THEN** the system SHALL not navigate and MAY show a subtle indicator

#### Scenario: Last page boundary
- **WHEN** user reaches the last page and attempts to advance
- **THEN** the system SHALL not navigate and MAY show a "Volume Complete" indicator

### Requirement: Two-page spread mode
The system SHALL support a two-page spread view on desktop viewports.

#### Scenario: Activating spread mode
- **WHEN** user is on a viewport wider than 1024px
- **THEN** the reader SHALL offer a toggle to switch between single and two-page spread mode

#### Scenario: Spread page layout
- **WHEN** spread mode is active
- **THEN** the system SHALL display two consecutive pages side-by-side, ordered according to the reading direction (RTL: right page first, left page second)

#### Scenario: Spread mode on mobile
- **WHEN** viewport is 1024px or narrower
- **THEN** spread mode SHALL NOT be available and the reader defaults to single-page mode

### Requirement: Reading direction
The system SHALL support both right-to-left (RTL) and left-to-right (LTR) reading directions, with RTL as the default.

#### Scenario: Default direction
- **WHEN** a new profile is created or no profile is selected
- **THEN** the reading direction SHALL default to RTL

#### Scenario: Direction affects navigation
- **WHEN** reading direction is set to RTL
- **THEN** swiping left advances to the next page and swiping right goes to the previous page

### Requirement: Page indicator
The system SHALL display the current page number and total page count.

#### Scenario: Page counter display
- **WHEN** user is reading a volume
- **THEN** the system SHALL display "Page X of Y" in a non-intrusive overlay that auto-hides after a few seconds and reappears on tap/click
