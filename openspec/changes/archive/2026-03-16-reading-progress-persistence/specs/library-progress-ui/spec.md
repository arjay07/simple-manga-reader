## ADDED Requirements

### Requirement: Display reading progress on volume cards
The series detail page SHALL show a progress indicator on each volume card that has saved reading progress. The indicator displays the current page and total pages.

#### Scenario: Volume has saved progress
- **WHEN** user views a series detail page and volume 3 has progress at page 45 of 180
- **THEN** the volume card shows a progress bar and "45 / 180" text

#### Scenario: Volume has no saved progress
- **WHEN** user views a series detail page and a volume has no progress record
- **THEN** the volume card shows no progress indicator

#### Scenario: Volume is fully read
- **WHEN** user has read to the last page of a volume
- **THEN** the volume card shows a completed state (full progress bar)

### Requirement: Continue Reading section in library
The library page SHALL display a "Continue Reading" section that shows the most recently read volume for the active profile. Tapping it navigates directly to the reader at the saved page.

#### Scenario: User has reading history
- **WHEN** user visits the library page and has progress on at least one volume
- **THEN** a "Continue Reading" section appears showing the most recently updated volume with its cover, title, and progress

#### Scenario: User taps Continue Reading
- **WHEN** user taps the Continue Reading entry
- **THEN** the reader opens at the saved page for that volume

#### Scenario: User has no reading history
- **WHEN** user visits the library page with no saved progress
- **THEN** the "Continue Reading" section is not displayed
