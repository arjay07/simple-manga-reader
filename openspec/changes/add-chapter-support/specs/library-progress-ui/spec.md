## MODIFIED Requirements

### Requirement: Display reading progress on unit cards
The series detail page SHALL show a progress indicator on each unit card that has saved reading progress. The indicator displays the current page and total pages. The card type is the same shape for volume and chapter series; only the label noun differs.

#### Scenario: Unit has saved progress
- **WHEN** user views a series detail page and the third unit has progress at page 45 of 180
- **THEN** the unit card shows a progress bar and "45 / 180" text

#### Scenario: Unit has no saved progress
- **WHEN** user views a series detail page and a unit has no progress record
- **THEN** the unit card shows no progress indicator

#### Scenario: Unit is fully read
- **WHEN** user has read to the last page of a unit
- **THEN** the unit card shows a completed state (full progress bar)

### Requirement: Continue Reading section in library
The library page SHALL display a "Continue Reading" section that promotes the most recently read unit to a full-width hero card, with remaining entries in a horizontal scroll below it. Card copy SHALL use kind-aware labels driven off the parent series's kind (e.g., "Volume 3" for volume series, "Chapter 47" for chapter series).

#### Scenario: User has one unit in progress
- **WHEN** user visits the library page and has progress on exactly one unit
- **THEN** a hero card is displayed showing the series cover, series title, unit title (using kind-aware noun), progress bar with page count, and a "Resume" button that navigates to the reader at the saved page

#### Scenario: User has multiple units in progress
- **WHEN** user visits the library page and has progress on 3 units
- **THEN** the most recently updated unit is shown as a hero card, and the remaining 2 units appear in a horizontal scroll section below the hero card

#### Scenario: User taps Resume on hero card
- **WHEN** user taps the "Resume" button on the hero card
- **THEN** the reader opens at the saved page for that unit

#### Scenario: User has no reading history
- **WHEN** user visits the library page with no saved progress
- **THEN** the "Continue Reading" section is not displayed

#### Scenario: User has 6 units in progress
- **WHEN** user visits the library page with progress on 6 units
- **THEN** the most recent is shown as a hero card, and the remaining 5 appear in the horizontal scroll

#### Scenario: Chapter-series unit in Continue Reading
- **WHEN** the most recent unit in progress belongs to a series with `kind='chapter'`
- **THEN** the hero card and any list entries refer to it using chapter terminology (e.g., "Chapter 47") rather than "Volume 47"
