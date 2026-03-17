## ADDED Requirements

### Requirement: Volume thumbnail API endpoint
The system SHALL provide a `GET /api/manga/[seriesId]/[volumeId]/thumbnail` endpoint that returns a JPEG thumbnail of the volume's first page.

#### Scenario: First request generates and caches thumbnail
- **WHEN** a thumbnail is requested for a volume that has no cached thumbnail
- **THEN** the server SHALL extract page 1 of the volume PDF using `pdftoppm` at 150 DPI
- **AND** save the result to `public/covers/volumes/{volumeId}.jpg`
- **AND** return the image

#### Scenario: Subsequent requests serve cached thumbnail
- **WHEN** a thumbnail is requested for a volume that has a cached thumbnail
- **THEN** the server SHALL serve the cached file without re-extraction

#### Scenario: Volume PDF not found
- **WHEN** a thumbnail is requested but the volume PDF does not exist on disk
- **THEN** the server SHALL return a 404 error

#### Scenario: pdftoppm not available
- **WHEN** `pdftoppm` is not installed on the system
- **THEN** the server SHALL return a 500 error with a message indicating the dependency is missing

### Requirement: Volume cards display thumbnails
Volume cards in the series detail page SHALL display the first-page thumbnail instead of the plain numbered placeholder.

#### Scenario: Thumbnail loads successfully
- **WHEN** a volume card is rendered
- **THEN** it SHALL request the thumbnail from `/api/manga/[seriesId]/[volumeId]/thumbnail`
- **AND** display the returned image as the volume cover

#### Scenario: Thumbnail fails to load
- **WHEN** the thumbnail request fails or returns an error
- **THEN** the volume card SHALL fall back to the existing numbered placeholder

### Requirement: Continue Reading section uses thumbnails
Volume cards in the "Continue Reading" section on the library page SHALL also display thumbnails.

#### Scenario: Continue Reading thumbnails
- **WHEN** a continue-reading volume card is rendered
- **THEN** it SHALL use the same thumbnail API endpoint for its cover image
