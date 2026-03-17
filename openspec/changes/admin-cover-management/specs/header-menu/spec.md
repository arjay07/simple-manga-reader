## ADDED Requirements

### Requirement: Consolidated header dropdown
The system SHALL replace the existing separate Rescan button and Theme toggle button with a single vertical-dots (⋮) menu button in the top-right corner of the header.

#### Scenario: Menu button visible on library page
- **WHEN** the user views the library page
- **THEN** a ⋮ button SHALL be visible in the top-right of the sticky header

#### Scenario: Menu button visible on series detail page
- **WHEN** the user views a series detail page
- **THEN** a ⋮ button SHALL be visible in the top-right of the sticky header

### Requirement: Dropdown menu contents
The header dropdown menu SHALL contain the following items in order: Admin Mode toggle, Theme toggle, Rescan library.

#### Scenario: Opening the menu
- **WHEN** the user clicks the ⋮ button
- **THEN** a dropdown menu SHALL appear with Admin Mode toggle, Theme toggle, and Rescan option

#### Scenario: Closing the menu
- **WHEN** the user clicks outside the dropdown or presses Escape
- **THEN** the dropdown SHALL close

### Requirement: Menu click-outside dismissal
The dropdown SHALL close when the user clicks anywhere outside of it.

#### Scenario: Click outside closes menu
- **WHEN** the dropdown is open and the user clicks outside it
- **THEN** the dropdown SHALL close
