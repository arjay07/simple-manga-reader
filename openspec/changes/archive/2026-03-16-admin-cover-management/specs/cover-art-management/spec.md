## ADDED Requirements

### Requirement: Series card admin menu
When admin mode is active, each series card in the library grid SHALL display a ⋮ menu button overlaid on the top-right corner of the cover image.

#### Scenario: Menu visible in admin mode
- **WHEN** admin mode is enabled
- **THEN** each series card SHALL show a ⋮ button on the cover image

#### Scenario: Menu hidden outside admin mode
- **WHEN** admin mode is disabled
- **THEN** no ⋮ button SHALL appear on series cards

### Requirement: Upload cover image
The series admin menu SHALL include an "Upload Cover" option that opens a file picker for image files.

#### Scenario: Successful upload
- **WHEN** the user selects "Upload Cover" and picks a valid image file
- **THEN** the image SHALL be uploaded via `POST /api/manga/[seriesId]/cover` as multipart form data
- **AND** the series cover SHALL update to show the new image without page reload

#### Scenario: Upload error
- **WHEN** the upload fails
- **THEN** an error message SHALL be displayed to the user

### Requirement: Set cover from URL
The series admin menu SHALL include a "Set Cover from URL" option that prompts for a URL.

#### Scenario: Successful URL download
- **WHEN** the user enters a valid image URL and confirms
- **THEN** the server SHALL download the image from the URL
- **AND** save it as the series cover at `public/covers/{seriesId}.jpg`
- **AND** the series cover SHALL update without page reload

#### Scenario: Invalid URL or download failure
- **WHEN** the URL is invalid, unreachable, or does not point to an image
- **THEN** the server SHALL return an error
- **AND** an error message SHALL be displayed to the user

#### Scenario: Server validates content type
- **WHEN** the server downloads from the provided URL
- **THEN** it SHALL verify the response content-type is an image type
- **AND** reject non-image responses

#### Scenario: Server enforces size limit
- **WHEN** the downloaded image exceeds 10MB
- **THEN** the server SHALL reject the download and return an error

### Requirement: Auto-generate cover from Volume 1
The series admin menu SHALL include an "Auto-generate Cover" option that extracts the first page of the first volume.

#### Scenario: Successful auto-generation
- **WHEN** the user selects "Auto-generate Cover" and the series has at least one volume
- **THEN** the server SHALL extract page 1 of the first volume (lowest volume_number) using `pdftoppm`
- **AND** save it as the series cover
- **AND** the cover SHALL update without page reload

#### Scenario: No volumes available
- **WHEN** the user selects "Auto-generate Cover" but the series has no volumes
- **THEN** an error message SHALL be displayed

#### Scenario: pdftoppm not available
- **WHEN** `pdftoppm` is not installed on the system
- **THEN** the server SHALL return an error indicating the dependency is missing
