## MODIFIED Requirements

### Requirement: Resume from saved page on unit open
When a user opens a reading unit they have previously read, the reader SHALL start at their last-read page rather than page 1. The saved progress is fetched server-side from SQLite using the profile ID and unit ID. The unit may be a volume or a chapter depending on the series's kind; resume behavior is identical across kinds.

#### Scenario: User opens a previously read unit
- **WHEN** user navigates to `/read/{seriesId}/{unitId}` and has saved progress at page 34
- **THEN** the reader opens at page 34

#### Scenario: User opens a unit with no saved progress
- **WHEN** user navigates to a unit they have never read
- **THEN** the reader opens at page 1

#### Scenario: User opens a unit without a profile selected
- **WHEN** user navigates to a unit without an active profile
- **THEN** the reader opens at page 1 (no progress lookup)

### Requirement: Persist progress to localStorage immediately on page change
The reader SHALL write the current page to localStorage on every page change, keyed by `progress:{profileId}:{unitId}`. This write is synchronous and not debounced.

#### Scenario: User changes page
- **WHEN** user navigates to page 15
- **THEN** localStorage key `progress:{profileId}:{unitId}` is set to `15` immediately

#### Scenario: User changes page and refreshes within 1 second
- **WHEN** user navigates to page 15 and refreshes before the DB debounce fires
- **THEN** the reader resumes at page 15 (read from localStorage)

### Requirement: Use maximum of DB and localStorage on mount
On mount, the reader SHALL compare the server-provided initial page (from DB) with the localStorage value (under the new `unitId` key, falling back to the legacy `volumeId` key if the migration shim has not yet copied it) and use whichever is higher.

#### Scenario: localStorage has a higher page than DB
- **WHEN** DB has page 30 and localStorage has page 32 under `progress:{profileId}:{unitId}`
- **THEN** the reader opens at page 32

#### Scenario: DB has a higher page than localStorage
- **WHEN** DB has page 30 and localStorage has no entry under the new key or a lower value
- **THEN** the reader opens at page 30

#### Scenario: Legacy localStorage key present
- **WHEN** DB has page 30 and only the legacy `progress:{profileId}:{volumeId}` key exists at page 32 (numeric ID matches; unit IDs preserve the old volume IDs after migration)
- **THEN** the reader opens at page 32, reading from the legacy key via the migration shim

### Requirement: Clean up localStorage after successful DB save
The reader SHALL remove the localStorage key for a unit after the debounced DB save completes successfully. The clean-up SHALL remove both the new (`unitId`) and legacy (`volumeId`) keys if both are present.

#### Scenario: Debounced save succeeds
- **WHEN** the 1s debounced `POST /api/progress` returns successfully
- **THEN** the localStorage key `progress:{profileId}:{unitId}` is removed

#### Scenario: Legacy key cleaned up alongside new key
- **WHEN** the debounced save succeeds and a legacy `progress:{profileId}:{volumeId}` key also exists
- **THEN** both the legacy and new keys are removed

### Requirement: Single-unit progress query
The `GET /api/progress` endpoint SHALL support an optional `unitId` query parameter to return progress for a single reading unit.

#### Scenario: Fetch progress for a specific unit
- **WHEN** client requests `GET /api/progress?profileId=1&unitId=5`
- **THEN** the API returns the progress record for that profile+unit, or null if none exists

## ADDED Requirements

### Requirement: Read-side migration shim for legacy localStorage keys
The reader SHALL migrate legacy `progress:{profileId}:{volumeId}` localStorage keys to the new `progress:{profileId}:{unitId}` format on first read. The shim SHALL copy the value to the new key and delete the legacy key, ensuring no progress is lost during the rename transition. Because the database migration preserves primary keys (`reading_units.id == volumes.id`), the numeric portion of the key is unchanged.

#### Scenario: Legacy key present, no new key
- **WHEN** the reader reads progress and only `progress:{profileId}:{volumeId}` is present
- **THEN** the shim copies the value to `progress:{profileId}:{unitId}`, deletes the legacy key, and returns the value

#### Scenario: Both legacy and new keys present
- **WHEN** both keys exist (an edge case where the user opened the reader twice during migration)
- **THEN** the shim deletes the legacy key without overwriting the new key

#### Scenario: Neither key present
- **WHEN** neither key exists for the requested unit
- **THEN** the shim is a no-op and the reader proceeds with no localStorage value
