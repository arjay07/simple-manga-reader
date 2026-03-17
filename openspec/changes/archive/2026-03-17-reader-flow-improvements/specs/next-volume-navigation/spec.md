## ADDED Requirements

### Requirement: Show end-of-volume overlay when reaching last page
The reader SHALL display a slide-up overlay card when the user reaches the last page of a volume. The overlay SHALL not block the final page content and SHALL be dismissible.

#### Scenario: User reaches last page with next volume available
- **WHEN** user navigates to the last page and the series has a subsequent volume
- **THEN** an overlay slides up showing "Continue to Vol. X" button and a "Back to Series" link

#### Scenario: User reaches last page with no next volume
- **WHEN** user navigates to the last page and this is the final volume in the series
- **THEN** an overlay slides up showing a "Series Complete" message and a "Back to Series" link

#### Scenario: User dismisses the overlay
- **WHEN** the end-of-volume overlay is visible and user taps the reading area or presses Escape
- **THEN** the overlay is dismissed and the user can continue viewing the last page

### Requirement: Navigate to next volume from overlay
The reader SHALL allow the user to navigate directly to the next volume via the overlay's continue button. Navigation SHALL open the next volume at page 1.

#### Scenario: User taps Continue to next volume
- **WHEN** user taps the "Continue to Vol. X" button on the overlay
- **THEN** the reader navigates to `/read/{seriesId}/{nextVolumeId}` and opens at page 1

### Requirement: Show start-of-volume overlay when navigating before page 1
The reader SHALL display an overlay when the user attempts to navigate before page 1 and a previous volume exists in the series.

#### Scenario: User tries to go before page 1 with previous volume available
- **WHEN** user is on page 1 and attempts to go to the previous page (swipe, tap zone, or arrow key) and a previous volume exists
- **THEN** an overlay appears offering "Go to Vol. X" (previous volume) and "Back to Series"

#### Scenario: User tries to go before page 1 with no previous volume
- **WHEN** user is on page 1 and attempts to go to the previous page and this is the first volume
- **THEN** no overlay is shown and no navigation occurs (current behavior preserved)

### Requirement: Trigger overlay on navigation past boundaries
Attempting to navigate past the last page (swipe, tap-to-turn zone, arrow key, or desktop arrow button) SHALL trigger the end-of-volume overlay rather than being silently clamped.

#### Scenario: User swipes past last page
- **WHEN** user is on the last page and swipes to advance
- **THEN** the end-of-volume overlay is shown

#### Scenario: User presses arrow key past last page
- **WHEN** user is on the last page and presses the "next page" arrow key
- **THEN** the end-of-volume overlay is shown

### Requirement: Server-side adjacent volume resolution
The reader's server component SHALL query the next and previous volumes by `volume_number` ordering and pass their IDs and titles to the client component.

#### Scenario: Volume has adjacent volumes
- **WHEN** the reader loads volume 3 of a series with volumes 1–5
- **THEN** `nextVolumeId` is set to volume 4's ID and `prevVolumeId` is set to volume 2's ID

#### Scenario: Volume is last in series
- **WHEN** the reader loads the last volume of a series
- **THEN** `nextVolumeId` is undefined and `prevVolumeId` is set to the preceding volume's ID

#### Scenario: Volume is first in series
- **WHEN** the reader loads the first volume of a series
- **THEN** `prevVolumeId` is undefined and `nextVolumeId` is set to the following volume's ID
