## ADDED Requirements

### Requirement: Horizontal single-page mode renders a 3-canvas carousel strip
In horizontal single-page mode the reader SHALL maintain three canvases in the DOM (previous, current, next), laid out in a flex-row strip 300vw wide, so adjacent pages are always ready to animate into view. Spread mode is excluded.

#### Scenario: Strip is centered on current page at rest
- **WHEN** no drag is in progress
- **THEN** the strip SHALL be translated to `translateX(-100vw)` so the current-page canvas fills the viewport

#### Scenario: Adjacent pages are rendered alongside the current page
- **WHEN** the current page is displayed
- **THEN** the next-page canvas SHALL contain the rendered next page (direction-aware) and the previous-page canvas SHALL contain the rendered previous page
- **WHEN** the current page is the first page
- **THEN** the previous-page canvas SHALL be empty (zero dimensions)
- **WHEN** the current page is the last page
- **THEN** the next-page canvas SHALL be empty (zero dimensions)

### Requirement: Touch drag translates the strip in real time
While a finger is held down in horizontal single-page mode, the strip SHALL translate continuously to follow the finger, giving visual feedback of the adjacent page sliding in.

#### Scenario: Strip follows finger during drag
- **WHEN** the user places a finger on the screen and drags horizontally
- **THEN** the strip's `translateX` SHALL update on every `touchmove` event to `calc(-100vw + ${dragOffset}px)` with no CSS transition active

#### Scenario: No animation fires during active drag
- **WHEN** a drag is in progress
- **THEN** no CSS transition SHALL be applied to the strip so movement is immediate

### Requirement: Release snaps to page or springs back based on drag threshold
On finger release, the strip SHALL animate to the next or previous page if the drag exceeded 30% of the screen width, otherwise animate back to the current page.

#### Scenario: Drag exceeds threshold — snap forward
- **WHEN** the user releases with `|dragOffset| >= 30% of window.innerWidth` in the forward direction
- **THEN** the strip SHALL animate to `translateX(±100vw)` with a ~250ms ease-out transition, then update `currentPage` and reset the strip to `translateX(-100vw)` without transition

#### Scenario: Drag below threshold — spring back
- **WHEN** the user releases with `|dragOffset| < 30% of window.innerWidth`
- **THEN** the strip SHALL animate back to `translateX(-100vw)` with a ~250ms ease-out transition and `currentPage` SHALL NOT change

#### Scenario: No navigation past first or last page
- **WHEN** the user drags past the threshold at the first page in the backward direction
- **THEN** the strip SHALL spring back and `currentPage` SHALL NOT change
- **WHEN** the user drags past the threshold at the last page in the forward direction
- **THEN** the strip SHALL spring back (or trigger the end-of-volume overlay) and `currentPage` SHALL NOT change

### Requirement: New drag input is ignored while a snap animation is in progress
To prevent page-skipping, the reader SHALL ignore new touch and scroll-wheel inputs until the current snap animation completes.

#### Scenario: Second touch during animation is ignored
- **WHEN** a snap animation is in progress
- **THEN** any new `touchstart` event SHALL be ignored until the `transitionend` event fires

### Requirement: Scroll wheel triggers the slide animation in horizontal mode
In horizontal single-page mode, a mouse wheel scroll SHALL trigger the same slide animation as a completed swipe, debounced by the animation lock.

#### Scenario: Scroll down triggers forward page animation
- **WHEN** the user scrolls down (positive `deltaY`) on the reader in horizontal single-page mode
- **THEN** the strip SHALL animate to the next page using the same slide animation as a threshold-crossing swipe

#### Scenario: Scroll up triggers backward page animation
- **WHEN** the user scrolls up (negative `deltaY`) on the reader in horizontal single-page mode
- **THEN** the strip SHALL animate to the previous page using the same slide animation as a threshold-crossing swipe

#### Scenario: Scroll wheel is gated by animation lock
- **WHEN** a slide animation is in progress
- **THEN** scroll wheel events SHALL be ignored until the animation completes

#### Scenario: Default scroll behavior is suppressed in horizontal mode
- **WHEN** the reader is in horizontal single-page mode
- **THEN** `wheel` events on the reader container SHALL call `preventDefault()` to prevent the browser from scrolling the page
