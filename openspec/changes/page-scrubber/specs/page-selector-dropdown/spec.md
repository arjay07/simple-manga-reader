## ADDED Requirements

### Requirement: Page indicator text is clickable
The "Page X / Y" text in the bottom bar SHALL be a clickable button that toggles the page selector dropdown.

#### Scenario: Click page indicator
- **WHEN** the user clicks the "Page X / Y" text in the bottom bar
- **THEN** the page selector dropdown opens above the bottom bar

#### Scenario: Click page indicator while dropdown open
- **WHEN** the user clicks the "Page X / Y" text while the dropdown is already open
- **THEN** the dropdown closes

### Requirement: Dropdown shows scrollable page list
The dropdown SHALL display a vertically scrollable list of all pages, with each item showing "Page X". The current page SHALL be visually highlighted.

#### Scenario: Dropdown opens
- **WHEN** the page selector dropdown opens
- **THEN** a scrollable list appears above the bottom bar listing all pages from 1 to totalPages, with the current page highlighted and scrolled into view (centered)

### Requirement: Page selection navigates and closes dropdown
Clicking a page in the dropdown SHALL navigate to that page and close the dropdown.

#### Scenario: Select a page
- **WHEN** the user clicks "Page 12" in the dropdown
- **THEN** the reader navigates to page 12 and the dropdown closes

### Requirement: Dropdown closes on outside click or Escape
The dropdown SHALL close when the user clicks outside of it or presses the Escape key.

#### Scenario: Click outside dropdown
- **WHEN** the dropdown is open and the user clicks anywhere outside the dropdown and the page indicator button
- **THEN** the dropdown closes without changing the page

#### Scenario: Press Escape
- **WHEN** the dropdown is open and the user presses the Escape key
- **THEN** the dropdown closes without changing the page

### Requirement: Dropdown has bounded height
The dropdown SHALL have a maximum height and become scrollable when the page count exceeds the visible area.

#### Scenario: Volume with many pages
- **WHEN** the dropdown opens for a volume with 200 pages
- **THEN** the dropdown shows a scrollable list with a bounded maximum height, not extending beyond the viewport
