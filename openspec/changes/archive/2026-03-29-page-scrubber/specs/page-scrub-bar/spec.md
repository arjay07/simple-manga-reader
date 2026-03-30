## ADDED Requirements

### Requirement: Scrub bar displays on top edge of bottom bar
The reader SHALL display an interactive scrub bar positioned at the top edge of the bottom bar when bars are visible. The scrub bar SHALL show a filled progress region proportional to `currentPage / totalPages` and a circular draggable handle at the current position.

#### Scenario: Bars become visible
- **WHEN** the user toggles bars to visible
- **THEN** the scrub bar slides in together with the bottom bar, showing progress fill and handle at the current page position

#### Scenario: Bars become hidden
- **WHEN** the user toggles bars to hidden
- **THEN** the scrub bar slides out together with the bottom bar

### Requirement: Persistent thin progress line when bars are hidden
The reader SHALL display a thin (2-3px) non-interactive progress line at the very bottom of the screen at all times, showing reading progress as a colored fill proportional to `currentPage / totalPages`.

#### Scenario: Reading with bars hidden
- **WHEN** the bottom bar is hidden
- **THEN** a thin progress line remains visible at the bottom of the screen showing current reading position

#### Scenario: Page changes while bars hidden
- **WHEN** the user navigates to a different page while bars are hidden
- **THEN** the thin progress line updates to reflect the new position

### Requirement: Scrub bar supports click to jump
The scrub bar SHALL allow the user to click any position to jump directly to the corresponding page.

#### Scenario: Click on scrub bar
- **WHEN** the user clicks a position on the scrub bar
- **THEN** the reader navigates to the page corresponding to that horizontal position (mapped proportionally across total pages)

### Requirement: Scrub bar supports drag to scrub
The scrub bar SHALL allow the user to press and drag the handle (or any point on the bar) to scrub through pages. The page change SHALL be committed on release.

#### Scenario: Drag scrub handle
- **WHEN** the user presses down on the scrub bar and drags horizontally
- **THEN** the handle follows the drag position, the thumbnail preview updates to show the page at the drag position, and the page number label updates accordingly
- **WHEN** the user releases the drag
- **THEN** the reader navigates to the page at the release position

### Requirement: Scrub bar supports touch drag
The scrub bar SHALL support touch-based dragging with the same behavior as mouse dragging.

#### Scenario: Touch drag on mobile
- **WHEN** the user touches and drags on the scrub bar on a touch device
- **THEN** the handle follows the touch position with thumbnail and page number preview, and navigation commits on touch end

### Requirement: Thumbnail preview on hover and drag
The scrub bar SHALL display a tooltip above the hovered/dragged position containing a rendered thumbnail of the corresponding page and a page number label ("Page X") below the thumbnail.

#### Scenario: Mouse hover over scrub bar
- **WHEN** the user hovers over a position on the scrub bar without clicking
- **THEN** a tooltip appears above that position showing a thumbnail of the corresponding page and "Page X" label

#### Scenario: Thumbnail not yet cached
- **WHEN** the user hovers over a page whose thumbnail has not been rendered yet
- **THEN** a placeholder (gray box) is shown briefly while the thumbnail renders, then the thumbnail replaces it

#### Scenario: Thumbnail already cached
- **WHEN** the user hovers over a page whose thumbnail was previously rendered
- **THEN** the cached thumbnail displays immediately with no delay

### Requirement: Page number label always visible during scrub
The scrub bar tooltip SHALL always display the page number label ("Page X") during hover and drag, even while the thumbnail is loading.

#### Scenario: Scrubbing with thumbnail loading
- **WHEN** the user is dragging across the scrub bar and the thumbnail for the current position is not yet cached
- **THEN** the page number label ("Page X") is displayed immediately, and the thumbnail placeholder is shown until rendering completes

### Requirement: Scrub bar not shown in vertical scroll mode
The scrub bar SHALL NOT be displayed when the reader is in vertical scroll mode.

#### Scenario: Vertical scroll mode active
- **WHEN** the reading direction is set to vertical
- **THEN** neither the scrub bar nor the thin progress line is rendered
