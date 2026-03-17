## ADDED Requirements

### Requirement: Filesystem-based storage
The system SHALL use `~/manga/` as the root directory for manga storage, with one subfolder per series.

#### Scenario: Expected folder structure
- **WHEN** the system scans for manga
- **THEN** it SHALL expect the structure: `~/manga/<Series Name>/<Volume>.pdf`

#### Scenario: Storage path configuration
- **WHEN** the application starts
- **THEN** the manga storage path SHALL be configurable via a `MANGA_DIR` environment variable, defaulting to `~/manga/`

### Requirement: SQLite metadata database
The system SHALL store all metadata, profiles, and reading progress in a SQLite database.

#### Scenario: Database location
- **WHEN** the application starts
- **THEN** the database SHALL be created at `data/manga-reader.db` within the project directory if it does not exist

#### Scenario: Database initialization
- **WHEN** the database is created for the first time
- **THEN** the system SHALL create all required tables (profiles, series, volumes, reading_progress)

### Requirement: Volume number extraction
The system SHALL attempt to extract volume numbers from PDF filenames.

#### Scenario: Numeric pattern in filename
- **WHEN** a filename contains a number pattern (e.g., "DRAGON BALL VOLUME 01.pdf")
- **THEN** the system SHALL extract "1" as the volume number

#### Scenario: No number in filename
- **WHEN** a filename contains no recognizable number
- **THEN** the system SHALL assign volumes in alphabetical order

### Requirement: PDF file serving
The system SHALL serve PDF files from the manga storage directory to the browser.

#### Scenario: Serving a volume
- **WHEN** the reader requests a PDF file
- **THEN** the API SHALL stream the file from the filesystem with appropriate content-type headers

#### Scenario: File not found
- **WHEN** a requested PDF no longer exists on disk
- **THEN** the API SHALL return a 404 error and the UI SHALL display a message that the file is missing
