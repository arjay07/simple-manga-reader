## ADDED Requirements

### Requirement: Admin panel detection route
The system SHALL provide an admin page at `/admin/panel-detect` for testing panel detection on manga pages from the library.

#### Scenario: Page accessible
- **WHEN** a user navigates to `/admin/panel-detect`
- **THEN** the page SHALL load with controls for selecting a series, volume, and page number

### Requirement: Series and volume selection
The admin page SHALL allow users to select a series and volume from the existing manga library.

#### Scenario: Series dropdown populated
- **WHEN** the page loads
- **THEN** a series dropdown SHALL be populated with all series from the library API

#### Scenario: Volume dropdown updates on series selection
- **WHEN** a series is selected
- **THEN** a volume dropdown SHALL be populated with all volumes in that series

### Requirement: Page number input
The admin page SHALL allow users to specify which page to analyze.

#### Scenario: Page number entry
- **WHEN** a volume is selected
- **THEN** a page number input SHALL be available, defaulting to page 1

#### Scenario: Page navigation
- **WHEN** a page is being viewed
- **THEN** previous/next buttons SHALL allow stepping through pages without re-selecting the volume

### Requirement: Run analysis action
The admin page SHALL provide an action to run panel detection on the selected page.

#### Scenario: Analyze button triggers detection
- **WHEN** the user clicks the "Analyze" button with a valid series, volume, and page selected
- **THEN** the system SHALL call `POST /api/panel-detect` with both methods and display a loading state

#### Scenario: Loading state
- **WHEN** analysis is in progress
- **THEN** the UI SHALL display a loading indicator and disable the analyze button

### Requirement: Side-by-side visual comparison
The admin page SHALL display detection results from both methods side by side with visual overlays.

#### Scenario: Panel overlay rendering
- **WHEN** detection results are returned
- **THEN** the page image SHALL be displayed twice (once per method) with colored bounding boxes overlaid on each panel, labeled with the reading order number

#### Scenario: Method labels and timing
- **WHEN** results are displayed
- **THEN** each side SHALL show the method name, processing time, number of panels detected, and page type classification

#### Scenario: Distinct visual styling per method
- **WHEN** both method overlays are shown
- **THEN** each method SHALL use a distinct bounding box color (e.g., blue for contour, green for ML) for easy differentiation

### Requirement: JSON output display
The admin page SHALL display the raw JSON detection output.

#### Scenario: JSON viewer
- **WHEN** detection results are returned
- **THEN** the full JSON response SHALL be displayed in a formatted, readable view below the visual comparison

#### Scenario: Copy JSON
- **WHEN** the JSON output is displayed
- **THEN** a copy button SHALL allow copying the full JSON to the clipboard
