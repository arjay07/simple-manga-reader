## MODIFIED Requirements

### Requirement: Continue Reading section in library
The library page SHALL display a "Continue Reading" section that promotes the most recently read volume to a full-width hero card, with remaining entries in a horizontal scroll below it.

#### Scenario: User has one volume in progress
- **WHEN** user visits the library page and has progress on exactly one volume
- **THEN** a hero card is displayed showing the series cover, series title, volume title, progress bar with page count, and a "Resume" button that navigates to the reader at the saved page

#### Scenario: User has multiple volumes in progress
- **WHEN** user visits the library page and has progress on 3 volumes
- **THEN** the most recently updated volume is shown as a hero card, and the remaining 2 volumes appear in a horizontal scroll section below the hero card

#### Scenario: User taps Resume on hero card
- **WHEN** user taps the "Resume" button on the hero card
- **THEN** the reader opens at the saved page for that volume

#### Scenario: User has no reading history
- **WHEN** user visits the library page with no saved progress
- **THEN** the "Continue Reading" section is not displayed

#### Scenario: User has 6 volumes in progress
- **WHEN** user visits the library page with progress on 6 volumes
- **THEN** the most recent is shown as a hero card, and the remaining 5 appear in the horizontal scroll
