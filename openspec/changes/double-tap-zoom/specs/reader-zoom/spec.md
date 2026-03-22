## ADDED Requirements

### Requirement: Double-tap zoom entry
The reader SHALL detect a double-tap gesture (two taps within 280ms and within 40px of each other) in single-page carousel mode and zoom the current page to 2.5× centered on the tap point.

#### Scenario: Double-tap while in normal view
- **WHEN** the user double-taps anywhere on the page in single-page carousel mode
- **THEN** the page zooms to 2.5× with the tap point held visually stationary at the tapped position

#### Scenario: Double-tap in vertical or spread mode
- **WHEN** the user double-taps in vertical scroll mode or spread mode
- **THEN** no zoom occurs and existing behavior is unchanged

---

### Requirement: Double-tap zoom exit
The reader SHALL return to normal (1×) view when the user double-taps while already zoomed in.

#### Scenario: Double-tap while zoomed
- **WHEN** the user double-taps anywhere on the page while the page is zoomed in
- **THEN** the page animates back to 1× scale with a smooth transition (~200ms ease-out)

---

### Requirement: Pan while zoomed
While zoomed in, the reader SHALL allow the user to pan the page with a one-finger drag gesture. Pan SHALL be clamped so the page edge cannot move beyond the viewport edge.

#### Scenario: Drag within bounds
- **WHEN** the user drags with one finger while zoomed in
- **THEN** the page pans in the drag direction, following the finger

#### Scenario: Drag beyond page edge
- **WHEN** the user drags toward a direction where the page edge has already reached the viewport edge
- **THEN** the page does not move further in that direction (clamped)

---

### Requirement: Navigation blocked while zoomed
While zoomed in, the reader SHALL NOT navigate to adjacent pages via swipe or tap-to-turn. Swipe gestures SHALL instead pan the page.

#### Scenario: Swipe while zoomed
- **WHEN** the user swipes horizontally while zoomed in
- **THEN** the page pans (does not navigate to the next or previous page)

#### Scenario: Tap edges while zoomed
- **WHEN** the user taps the left or right edge zone while zoomed in
- **THEN** no page navigation occurs

---

### Requirement: Toolbar toggle while zoomed
While zoomed in, a single tap SHALL still toggle the toolbar and bottom bar visibility.

#### Scenario: Single tap while zoomed
- **WHEN** the user single-taps anywhere while zoomed in
- **THEN** the toolbar and bottom bar toggle (show/hide), and no page navigation occurs

---

### Requirement: Zoom resets on page change
When the reader navigates to a different page (by any mechanism), any active zoom SHALL be reset to 1× with pan offset cleared.

#### Scenario: Page navigation while zoomed
- **WHEN** the reader navigates to a new page while the current page is zoomed
- **THEN** the new page is displayed at 1× with no zoom or pan offset applied

---

### Requirement: Single-tap delay for double-tap disambiguation
In single-page carousel mode, single-tap actions (tap-to-turn, toolbar toggle) SHALL be deferred by ~280ms to allow the system to detect whether a second tap is incoming.

#### Scenario: Single tap with no follow-up tap
- **WHEN** the user taps once in paginated mode and no second tap arrives within 280ms
- **THEN** the tap-to-turn or toolbar toggle action executes

#### Scenario: Second tap arrives within 280ms
- **WHEN** a second tap arrives within 280ms of the first tap
- **THEN** the deferred single-tap action is cancelled and the double-tap action executes instead
