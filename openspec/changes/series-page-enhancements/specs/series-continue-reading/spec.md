## ADDED Requirements

### Requirement: Start Reading button for series with no progress
The series detail page SHALL display a "Start Reading" button when the active profile has no reading progress for any volume in the series. The button SHALL link to the first volume at page 1.

#### Scenario: No progress exists for the series
- **WHEN** the active profile has no reading progress for any volume in the series
- **THEN** the page displays a "Start Reading" button with a play icon that links to `/read/{seriesId}/{firstVolumeId}`

#### Scenario: Series has no volumes
- **WHEN** the series has zero volumes
- **THEN** no reading button is displayed

### Requirement: Continue Reading button for series with progress
The series detail page SHALL display a "Continue Reading" button when the active profile has reading progress on at least one volume in the series. The button SHALL show the target volume and page as a subtitle.

#### Scenario: Last-read volume is not finished
- **WHEN** the active profile last read volume 2 at page 34 of 180
- **THEN** the page displays a "Continue Reading" button with subtitle "Vol. 2 - Page 34" linking to `/read/{seriesId}/{volumeId}`

#### Scenario: Last-read volume is finished and next volume exists
- **WHEN** the active profile read to the last page of volume 2 and volume 3 exists
- **THEN** the button displays "Continue Reading" with subtitle "Vol. 3" linking to `/read/{seriesId}/{nextVolumeId}`

#### Scenario: All volumes are finished
- **WHEN** the active profile has read to the last page of every volume
- **THEN** the button displays "Continue Reading" with subtitle pointing to the last volume's last page

### Requirement: Prompt profile selection when no profile is active
The reading button SHALL be visible when no profile is selected, but SHALL redirect to the profile selector when clicked.

#### Scenario: No profile selected
- **WHEN** no profile is active and the user clicks the reading button
- **THEN** the user is navigated to `/` (profile selector page)

#### Scenario: No profile selected button label
- **WHEN** no profile is active
- **THEN** the button displays "Start Reading" with no subtitle

### Requirement: Determine reading destination by most recent progress
When multiple volumes have progress, the reading destination SHALL be determined by the volume with the most recent `updated_at` timestamp, then advanced if that volume is complete.

#### Scenario: Multiple volumes have progress
- **WHEN** profile has progress on volumes 1, 2, and 3, with volume 3 updated most recently at page 45
- **THEN** the Continue Reading button links to volume 3, page 45
