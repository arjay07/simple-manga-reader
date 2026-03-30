## ADDED Requirements

### Requirement: Viewport-aware lazy page rendering
The vertical scroll view SHALL only render pages that are within a buffer zone of 3 pages above and below the current viewport. Pages outside this buffer SHALL NOT be rendered.

#### Scenario: Initial load renders only visible pages plus buffer
- **WHEN** a manga volume is opened in vertical scroll mode
- **THEN** only the first page and up to 3 pages below it SHALL be rendered to canvas
- **THEN** the user SHALL see the first page within 1 second of the PDF document loading

#### Scenario: Scrolling into new pages triggers rendering
- **WHEN** the user scrolls and a new page enters the buffer zone
- **THEN** that page SHALL be rendered to its canvas

#### Scenario: Scrolling away from pages clears rendering
- **WHEN** a page leaves the buffer zone (more than 3 pages from the viewport)
- **THEN** that page's canvas SHALL be cleared to free memory
- **THEN** the canvas SHALL retain its placeholder dimensions

### Requirement: Placeholder page dimensions
Unrendered pages SHALL display as correctly-sized placeholders so that scroll position and scrollbar size are accurate.

#### Scenario: Placeholder height based on first page aspect ratio
- **WHEN** the PDF document loads in vertical scroll mode
- **THEN** page 1 SHALL be measured for its aspect ratio
- **THEN** all page canvases SHALL be sized to match that aspect ratio at the current container width

#### Scenario: Placeholder dimensions update on resize
- **WHEN** the browser window is resized
- **THEN** all placeholder dimensions SHALL be recalculated based on the new container width and the stored aspect ratio

### Requirement: Debounced resize re-rendering
The vertical scroll view SHALL debounce resize events and only re-render pages currently within the buffer zone.

#### Scenario: Window resize re-renders buffered pages only
- **WHEN** the browser window is resized
- **THEN** after a 300ms debounce period, only pages within the current buffer zone SHALL be re-rendered
- **THEN** pages outside the buffer zone SHALL NOT be re-rendered

### Requirement: Scroll position and page tracking preserved
The existing IntersectionObserver-based page tracking SHALL continue to report the most visible page for progress saving.

#### Scenario: Page tracking works with lazy rendering
- **WHEN** the user scrolls through the vertical view
- **THEN** the `onPageChange` callback SHALL fire with the most visible page number
- **THEN** reading progress SHALL be saved correctly
