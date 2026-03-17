## ADDED Requirements

### Requirement: Vertical scroll rendering
When reading direction is set to Vertical, the reader SHALL render all pages stacked vertically in a scrollable container. Each page SHALL be rendered to its own canvas element, scaled to fit the container width.

#### Scenario: Pages render stacked vertically
- **WHEN** the reader is in vertical scroll mode
- **THEN** all pages are rendered as vertically stacked canvases that the user can scroll through natively

#### Scenario: Pages fit container width
- **WHEN** a page is rendered in vertical scroll mode
- **THEN** the page canvas width matches the container width and height scales proportionally

### Requirement: Scroll-based progress tracking
In vertical scroll mode, reading progress SHALL be tracked based on which page is most visible in the viewport.

#### Scenario: Progress updates on scroll
- **WHEN** the user scrolls and page 10 becomes the most visible page in the viewport
- **THEN** the current page is updated to 10 and progress is saved (debounced)

#### Scenario: Page indicator reflects scroll position
- **WHEN** the user scrolls to page 10
- **THEN** the bottom bar displays "Page 10 / 180"

### Requirement: Navigation differs in vertical mode
In vertical scroll mode, horizontal swipe and tap-to-turn SHALL be disabled. Keyboard up/down arrows SHALL scroll the view.

#### Scenario: Swipe disabled in vertical mode
- **WHEN** the user swipes left or right in vertical scroll mode
- **THEN** nothing happens (no page turn)

#### Scenario: Keyboard scrolls vertically
- **WHEN** the user presses the up or down arrow keys in vertical scroll mode
- **THEN** the view scrolls up or down

### Requirement: Spread mode disabled in vertical mode
Spread mode SHALL not be available when in vertical scroll mode.

#### Scenario: Spread mode off in vertical
- **WHEN** the user switches to vertical scroll mode while spread mode is active
- **THEN** spread mode is automatically disabled
