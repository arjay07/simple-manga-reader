## ADDED Requirements

### Requirement: Unified navigation dispatch
The manga reader SHALL provide a single `navigateReading(direction: 'forward' | 'back')` function that all input handlers delegate to for page/panel navigation. This function SHALL determine the correct navigation action based on the current reading mode (single page, spread, panel zoom) and execute it with the appropriate visual transition.

#### Scenario: Panel zoom mode with panels on current page
- **WHEN** smart panel zoom is active and the current page has panel data with `pageType === 'panels'`
- **THEN** `navigateReading('forward')` SHALL advance to the next panel (or next page's first panel if on the last panel), matching existing `advancePanel` behavior

#### Scenario: Panel zoom mode with no panels on current page
- **WHEN** smart panel zoom is active and the current page has `pageType` of "cover", "full-bleed", or "blank"
- **THEN** `navigateReading('forward')` SHALL advance to the next page using a carousel slide animation

#### Scenario: Single page mode without panel zoom
- **WHEN** the reader is in single-page paginated mode without smart panel zoom
- **THEN** `navigateReading('forward')` SHALL advance to the next page using the carousel slide animation (`animateStrip`)

#### Scenario: Spread mode
- **WHEN** the reader is in spread (two-page) mode
- **THEN** `navigateReading('forward')` SHALL advance by 2 pages using `goNextPage` (no carousel animation, since spread mode does not use the strip)

### Requirement: All input handlers use unified navigation
Every input method SHALL delegate to `navigateReading` for forward/backward navigation instead of calling page-change or panel-advance functions directly.

#### Scenario: Keyboard arrow navigation
- **WHEN** the user presses ArrowLeft or ArrowRight in paginated mode
- **THEN** the handler SHALL map the key to `'forward'` or `'back'` based on reading direction and call `navigateReading`

#### Scenario: Arrow button navigation
- **WHEN** the user clicks the left or right arrow overlay button
- **THEN** the handler SHALL map the button to `'forward'` or `'back'` based on reading direction and call `navigateReading`

#### Scenario: Touch swipe navigation
- **WHEN** the user completes a horizontal swipe gesture in paginated mode
- **THEN** the handler SHALL determine swipe direction relative to reading direction and call `navigateReading`

#### Scenario: Scroll wheel navigation
- **WHEN** the user scrolls the wheel in paginated mode (including spread mode)
- **THEN** the handler SHALL map scroll direction to `'forward'` or `'back'` and call `navigateReading`

#### Scenario: Container click/tap zone navigation
- **WHEN** the user clicks/taps the left 25% or right 25% of the reader viewport (with tap-to-turn enabled or panel zoom active)
- **THEN** the handler SHALL map the zone to `'forward'` or `'back'` based on reading direction and call `navigateReading`

#### Scenario: Direct page jump excluded
- **WHEN** the user selects a page via the scrub bar or page dropdown
- **THEN** the page SHALL change immediately via `setCurrentPage` without going through `navigateReading` (no animation)

### Requirement: Consistent carousel animation for page turns
All paginated single-page mode page turns triggered by user navigation (not direct jumps) SHALL use the carousel strip slide animation (`animateStrip`) for visual consistency.

#### Scenario: Keyboard triggers carousel animation
- **WHEN** the user presses an arrow key to change pages in single-page mode
- **THEN** the page transition SHALL use the 250ms carousel slide animation, not an instant swap

#### Scenario: Arrow button triggers carousel animation
- **WHEN** the user clicks an arrow overlay button in single-page mode
- **THEN** the page transition SHALL use the 250ms carousel slide animation

### Requirement: Backward navigation in panel zoom click mode
When smart panel zoom is active, container click/tap SHALL support both forward and backward navigation using tap zones.

#### Scenario: Backward tap in panel zoom mode
- **WHEN** smart panel zoom is active and the user taps the left 25% of the viewport (LTR) or right 25% (RTL)
- **THEN** the reader SHALL navigate backward (retreat panel or previous page)

#### Scenario: Forward tap in panel zoom mode
- **WHEN** smart panel zoom is active and the user taps the right 75% of the viewport (LTR) or left 75% (RTL)
- **THEN** the reader SHALL navigate forward (advance panel or next page)

### Requirement: Scroll wheel in spread mode
The scroll wheel SHALL trigger page navigation in spread mode.

#### Scenario: Scroll down in spread mode
- **WHEN** the user scrolls down in spread mode
- **THEN** the reader SHALL advance to the next spread (2 pages forward)

#### Scenario: Scroll up in spread mode
- **WHEN** the user scrolls up in spread mode
- **THEN** the reader SHALL go to the previous spread (2 pages backward)
