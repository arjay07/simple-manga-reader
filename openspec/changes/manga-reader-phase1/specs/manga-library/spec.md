## ADDED Requirements

### Requirement: Library grid view
The system SHALL display all manga series in a responsive grid layout with cover art.

#### Scenario: Viewing the library
- **WHEN** user navigates to the library page
- **THEN** the system SHALL display a grid of series cards, each showing the cover image and series title

#### Scenario: Empty library
- **WHEN** no manga series exist in the storage directory
- **THEN** the system SHALL display a message indicating the library is empty with instructions on how to add manga

### Requirement: Series detail view
The system SHALL display all volumes within a series when a series card is selected.

#### Scenario: Viewing a series
- **WHEN** user clicks/taps on a series card
- **THEN** the system SHALL display all volumes in the series, ordered by volume number, with individual volume covers or numbered labels

#### Scenario: Opening a volume
- **WHEN** user clicks/taps on a volume
- **THEN** the system SHALL open the PDF reader for that volume

### Requirement: Cover art display
The system SHALL display cover art for each series in the library grid.

#### Scenario: Auto-extracted cover
- **WHEN** a series has no custom cover set and volumes exist
- **THEN** the system SHALL auto-extract the first page of the first volume as the cover image

#### Scenario: Custom cover
- **WHEN** a user uploads a custom cover image for a series
- **THEN** the system SHALL use the custom image instead of the auto-extracted cover

#### Scenario: Cover image format
- **WHEN** a cover is extracted or uploaded
- **THEN** the system SHALL store it as a JPEG or PNG file in the `public/covers/` directory

### Requirement: Folder scanning
The system SHALL scan the manga storage directory to detect series and volumes.

#### Scenario: Initial scan
- **WHEN** the application starts
- **THEN** the system SHALL scan `/home/arjay/manga/` for series folders and PDF files within them, populating the database

#### Scenario: New series detected
- **WHEN** a new folder is found in the manga storage directory during a scan
- **THEN** the system SHALL create a new series entry in the database with the folder name as the title

#### Scenario: New volume detected
- **WHEN** a new PDF file is found in a series folder during a scan
- **THEN** the system SHALL create a new volume entry and attempt to extract the volume number from the filename

#### Scenario: Manual rescan
- **WHEN** user triggers a rescan from the library UI
- **THEN** the system SHALL re-scan the storage directory and update the database, adding new entries and marking missing files
