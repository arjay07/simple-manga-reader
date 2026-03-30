## MODIFIED Requirements

### Requirement: Next page is pre-rendered in the background in paginated mode
In single-page horizontal mode, the reader SHALL render the previous page AND the next logical page (direction-aware) into the carousel strip's adjacent canvases after the current page finishes rendering. The offscreen canvas pre-render system is replaced by the always-in-DOM carousel strip canvases.

#### Scenario: Both neighbors are rendered after current page
- **WHEN** the current page finishes rendering in single-page paginated mode
- **THEN** the reader SHALL render the previous page into the prev-slot canvas and the next page into the next-slot canvas

#### Scenario: Pre-render respects reading direction
- **WHEN** the reading direction is RTL
- **THEN** the next-in-reading-order page SHALL be `currentPage - 1` rendered in the next-slot canvas
- **WHEN** the reading direction is LTR
- **THEN** the next-in-reading-order page SHALL be `currentPage + 1` rendered in the next-slot canvas

#### Scenario: Pre-render is cancelled on navigation
- **WHEN** the user navigates to a different page before neighbor rendering completes
- **THEN** any in-progress render tasks for the old neighbors SHALL be cancelled and new renders SHALL begin for the new page's neighbors

#### Scenario: Pre-render is not active in vertical scroll mode
- **WHEN** the reading direction is vertical scroll
- **THEN** no carousel pre-render SHALL occur (vertical scroll mode has its own IntersectionObserver-based buffer)

#### Scenario: Pre-render is not active in spread mode
- **WHEN** the reader is in spread (two-page) mode
- **THEN** no carousel pre-render SHALL occur (spread mode retains instant page switching)
