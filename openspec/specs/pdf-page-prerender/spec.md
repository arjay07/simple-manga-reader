### Requirement: Next page is pre-rendered in the background in paginated mode
After the current page finishes rendering in paginated mode, the reader SHALL begin rendering the next logical page (direction-aware) into an off-screen canvas using `requestIdleCallback` so it does not compete with the current render.

#### Scenario: Pre-render starts after current page completes
- **WHEN** the current page finishes rendering in single-page paginated mode
- **THEN** the reader SHALL begin rendering the next page into an off-screen canvas during idle time

#### Scenario: Pre-render respects reading direction
- **WHEN** the reading direction is RTL
- **THEN** the pre-rendered page SHALL be `currentPage - 1` (the next page in reading order)
- **WHEN** the reading direction is LTR
- **THEN** the pre-rendered page SHALL be `currentPage + 1`

#### Scenario: Pre-render is cancelled on navigation
- **WHEN** the user navigates to a different page before pre-rendering completes
- **THEN** the in-progress pre-render task SHALL be cancelled and a new pre-render for the new page's neighbor SHALL be queued

#### Scenario: Pre-render is not active in vertical scroll mode
- **WHEN** the reading direction is vertical scroll
- **THEN** no pre-render SHALL occur (vertical scroll mode has its own IntersectionObserver-based buffer)

#### Scenario: Pre-render is not active in spread mode
- **WHEN** the reader is in spread (two-page) mode
- **THEN** no pre-render SHALL occur to avoid excessive memory usage from rendering 3+ pages simultaneously
