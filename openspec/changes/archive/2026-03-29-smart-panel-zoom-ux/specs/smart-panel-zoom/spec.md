## MODIFIED Requirements

### Requirement: Panel-by-panel navigation
When smart panel zoom is active and panel data is available for the current page, the reader SHALL support bidirectional panel navigation via swipe gestures (touch) and click-to-advance (desktop). Tapping SHALL no longer advance panels on touch devices.

#### Scenario: Navigate to next panel via swipe
- **WHEN** the user swipes in the reading direction while zoomed into a panel and there are more panels on the current page
- **THEN** the view SHALL animate to the next panel in reading order

#### Scenario: Navigate to previous panel via swipe
- **WHEN** the user swipes against the reading direction while zoomed into a panel and there are earlier panels on the current page
- **THEN** the view SHALL animate to the previous panel in reading order

#### Scenario: Last panel on page (forward)
- **WHEN** the user swipes forward on the last panel of a page
- **THEN** the reader SHALL advance to the next page and zoom to the first panel with seamless carousel animation

#### Scenario: First panel on page (backward)
- **WHEN** the user swipes backward on the first panel of a page
- **THEN** the reader SHALL go to the previous page and zoom to the last panel with seamless carousel animation

#### Scenario: Desktop click to advance
- **WHEN** the user clicks (mouse) with smart panel zoom active
- **THEN** the reader SHALL advance to the next panel (existing click-to-advance behavior unchanged)

#### Scenario: Page with no panels (full-bleed/cover)
- **WHEN** the current page has `pageType` of "full-bleed", "cover", or "blank"
- **THEN** the reader SHALL display the full page without zooming and advance to the next page on swipe forward
