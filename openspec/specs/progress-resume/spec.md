## ADDED Requirements

### Requirement: Resume from saved page on volume open
When a user opens a volume they have previously read, the reader SHALL start at their last-read page rather than page 1. The saved progress is fetched server-side from SQLite using the profile ID and volume ID.

#### Scenario: User opens a previously read volume
- **WHEN** user navigates to `/read/{seriesId}/{volumeId}` and has saved progress at page 34
- **THEN** the reader opens at page 34

#### Scenario: User opens a volume with no saved progress
- **WHEN** user navigates to a volume they have never read
- **THEN** the reader opens at page 1

#### Scenario: User opens a volume without a profile selected
- **WHEN** user navigates to a volume without an active profile
- **THEN** the reader opens at page 1 (no progress lookup)

### Requirement: Persist progress to localStorage immediately on page change
The reader SHALL write the current page to localStorage on every page change, keyed by `progress:{profileId}:{volumeId}`. This write is synchronous and not debounced.

#### Scenario: User changes page
- **WHEN** user navigates to page 15
- **THEN** localStorage key `progress:{profileId}:{volumeId}` is set to `15` immediately

#### Scenario: User changes page and refreshes within 1 second
- **WHEN** user navigates to page 15 and refreshes before the DB debounce fires
- **THEN** the reader resumes at page 15 (read from localStorage)

### Requirement: Use maximum of DB and localStorage on mount
On mount, the reader SHALL compare the server-provided initial page (from DB) with the localStorage value and use whichever is higher.

#### Scenario: localStorage has a higher page than DB
- **WHEN** DB has page 30 and localStorage has page 32
- **THEN** the reader opens at page 32

#### Scenario: DB has a higher page than localStorage
- **WHEN** DB has page 30 and localStorage has no entry or a lower value
- **THEN** the reader opens at page 30

### Requirement: Clean up localStorage after successful DB save
The reader SHALL remove the localStorage key for a volume after the debounced DB save completes successfully.

#### Scenario: Debounced save succeeds
- **WHEN** the 1s debounced `POST /api/progress` returns successfully
- **THEN** the localStorage key `progress:{profileId}:{volumeId}` is removed

### Requirement: Single-volume progress query
The `GET /api/progress` endpoint SHALL support an optional `volumeId` query parameter to return progress for a single volume.

#### Scenario: Fetch progress for a specific volume
- **WHEN** client requests `GET /api/progress?profileId=1&volumeId=5`
- **THEN** the API returns the progress record for that profile+volume, or null if none exists
