## ADDED Requirements

### Requirement: Overall series progress bar
The series detail page SHALL display an aggregate progress bar showing total pages read across all volumes versus total pages in the series.

#### Scenario: Partial progress across volumes
- **WHEN** the series has 3 volumes with 200, 180, and 220 pages, and the profile has read 200, 90, and 0 pages respectively
- **THEN** the progress bar shows 290 / 600 pages (48%) with a filled bar at 48%

#### Scenario: No progress
- **WHEN** the active profile has no progress in the series
- **THEN** the progress bar is not displayed

#### Scenario: No profile selected
- **WHEN** no profile is active
- **THEN** the progress bar is not displayed

#### Scenario: Volumes with unknown page count
- **WHEN** a volume has null page_count
- **THEN** that volume is excluded from both the numerator and denominator of the progress calculation

### Requirement: Volume completion checkmark
Each volume card in the series detail page SHALL display a completion checkmark when the active profile has read to the last page of that volume.

#### Scenario: Volume is fully read
- **WHEN** the active profile's current page for a volume equals or exceeds the volume's page_count
- **THEN** the volume card displays a green checkmark badge in the top-right corner

#### Scenario: Volume is partially read
- **WHEN** the active profile's current page is less than the volume's page_count
- **THEN** no checkmark is displayed (the existing progress bar is sufficient)

#### Scenario: Volume has no page_count
- **WHEN** a volume has null page_count
- **THEN** no checkmark is displayed regardless of progress
