## MODIFIED Requirements

### Requirement: Panel-by-panel navigation
When smart panel zoom is active and panel data is available for the current page, the reader SHALL support bidirectional panel navigation via swipe gestures (touch) and click-to-advance (desktop). Wide panels that exceed the viewport width at height-fit zoom SHALL be divided into horizontal pan stops (max 3), and each swipe SHALL advance one stop before moving to the next panel.

#### Scenario: Navigate to next panel via swipe
- **WHEN** the user swipes in the reading direction while zoomed into a panel and on the last stop (or a single-stop panel) and there are more panels on the current page
- **THEN** the view SHALL animate to the next panel's first stop in reading order

#### Scenario: Navigate to next stop within panel
- **WHEN** the user swipes in the reading direction while zoomed into a multi-stop panel and not on the last stop
- **THEN** the view SHALL pan to the next horizontal stop within the same panel

#### Scenario: Navigate to previous panel via swipe
- **WHEN** the user swipes against the reading direction while zoomed into a panel and on the first stop (or a single-stop panel) and there are earlier panels on the current page
- **THEN** the view SHALL animate to the previous panel's last stop

#### Scenario: Navigate to previous stop within panel
- **WHEN** the user swipes against the reading direction while zoomed into a multi-stop panel and not on the first stop
- **THEN** the view SHALL pan to the previous horizontal stop within the same panel

#### Scenario: Last panel on page (forward)
- **WHEN** the user swipes forward on the last stop of the last panel of a page
- **THEN** the reader SHALL advance to the next page and zoom to the first panel's first stop with seamless carousel animation

#### Scenario: First panel on page (backward)
- **WHEN** the user swipes backward on the first stop of the first panel of a page
- **THEN** the reader SHALL go to the previous page and zoom to the last panel's last stop with seamless carousel animation

#### Scenario: Desktop click to advance
- **WHEN** the user clicks (mouse) with smart panel zoom active
- **THEN** the reader SHALL advance to the next stop, or to the next panel's first stop if on the last stop

#### Scenario: Page with no panels (full-bleed/cover)
- **WHEN** the current page has `pageType` of "full-bleed", "cover", or "blank"
- **THEN** the reader SHALL display the full page without zooming and advance to the next page on swipe forward
