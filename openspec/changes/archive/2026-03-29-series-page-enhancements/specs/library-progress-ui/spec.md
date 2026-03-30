## MODIFIED Requirements

### Requirement: Display reading progress on volume cards
The series detail page SHALL show a progress indicator on each volume card that has saved reading progress. The indicator displays the current page and total pages. When a volume is fully read (currentPage >= pageCount), the card SHALL display a green checkmark badge in addition to the full progress bar.

#### Scenario: Volume has saved progress
- **WHEN** user views a series detail page and volume 3 has progress at page 45 of 180
- **THEN** the volume card shows a progress bar and "45 / 180" text

#### Scenario: Volume has no saved progress
- **WHEN** user views a series detail page and a volume has no progress record
- **THEN** the volume card shows no progress indicator

#### Scenario: Volume is fully read
- **WHEN** user has read to the last page of a volume
- **THEN** the volume card shows a completed state (full progress bar) and a green checkmark badge in the top-right corner
