## MODIFIED Requirements

### Requirement: Show end-of-unit overlay when reaching last page
The reader SHALL display a slide-up overlay card when the user reaches the last page of a reading unit. The overlay SHALL not block the final page content and SHALL be dismissible. Overlay copy SHALL use kind-aware nouns driven off the parent series's kind ("Vol. X" for volume series, "Ch. X" for chapter series).

#### Scenario: User reaches last page with next unit available (volume series)
- **WHEN** user navigates to the last page and the series (`kind='volume'`) has a subsequent volume
- **THEN** an overlay slides up showing "Continue to Vol. X" button and a "Back to Series" link

#### Scenario: User reaches last page with next unit available (chapter series)
- **WHEN** user navigates to the last page and the series (`kind='chapter'`) has a subsequent chapter
- **THEN** an overlay slides up showing "Continue to Ch. X" button and a "Back to Series" link

#### Scenario: User reaches last page with no next unit
- **WHEN** user navigates to the last page and this is the final unit in the series
- **THEN** an overlay slides up showing a "Series Complete" message and a "Back to Series" link

#### Scenario: User dismisses the overlay
- **WHEN** the end-of-unit overlay is visible and user taps the reading area or presses Escape
- **THEN** the overlay is dismissed and the user can continue viewing the last page

### Requirement: Navigate to next unit from overlay
The reader SHALL allow the user to navigate directly to the next unit via the overlay's continue button. Navigation SHALL open the next unit at page 1.

#### Scenario: User taps Continue to next unit
- **WHEN** user taps the "Continue to ..." button on the overlay
- **THEN** the reader navigates to `/read/{seriesId}/{nextUnitId}` and opens at page 1

### Requirement: Show start-of-unit overlay when navigating before page 1
The reader SHALL display an overlay when the user attempts to navigate before page 1 and a previous unit exists in the series. Overlay copy uses kind-aware nouns.

#### Scenario: User tries to go before page 1 with previous unit available
- **WHEN** user is on page 1 and attempts to go to the previous page (swipe, tap zone, or arrow key) and a previous unit exists
- **THEN** an overlay appears offering "Go to Vol. X" or "Go to Ch. X" (kind-aware) and "Back to Series"

#### Scenario: User tries to go before page 1 with no previous unit
- **WHEN** user is on page 1 and attempts to go to the previous page and this is the first unit
- **THEN** no overlay is shown and no navigation occurs (current behavior preserved)

### Requirement: Trigger overlay on navigation past boundaries
Attempting to navigate past the last page (swipe, tap-to-turn zone, arrow key, or desktop arrow button) SHALL trigger the end-of-unit overlay rather than being silently clamped.

#### Scenario: User swipes past last page
- **WHEN** user is on the last page and swipes to advance
- **THEN** the end-of-unit overlay is shown

#### Scenario: User presses arrow key past last page
- **WHEN** user is on the last page and presses the "next page" arrow key
- **THEN** the end-of-unit overlay is shown

### Requirement: Server-side adjacent unit resolution
The reader's server component SHALL query the next and previous units by `unit_number` ordering and pass their IDs and titles to the client component, along with the parent series's `kind` so the client can render correct copy.

#### Scenario: Unit has adjacent units
- **WHEN** the reader loads unit 3 of a series with units 1–5
- **THEN** `nextUnitId` is set to unit 4's ID and `prevUnitId` is set to unit 2's ID

#### Scenario: Unit is last in series
- **WHEN** the reader loads the last unit of a series
- **THEN** `nextUnitId` is undefined and `prevUnitId` is set to the preceding unit's ID

#### Scenario: Unit is first in series
- **WHEN** the reader loads the first unit of a series
- **THEN** `prevUnitId` is undefined and `nextUnitId` is set to the following unit's ID

#### Scenario: Server passes series kind to client
- **WHEN** the reader's server component loads any unit
- **THEN** it passes `series.kind` to the client so overlay copy renders the correct noun
