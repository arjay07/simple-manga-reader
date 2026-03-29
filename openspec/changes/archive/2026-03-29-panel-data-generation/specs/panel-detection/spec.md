## ADDED Requirements

### Requirement: Standalone page image extraction endpoint
The system SHALL expose a `GET /api/panel-detect/page-image` endpoint for extracting a page image without running panel detection.

#### Scenario: Standalone page image extraction
- **WHEN** a GET request is made to `/api/panel-detect/page-image` with query parameters `seriesId`, `volumeId`, and `page`
- **THEN** the response SHALL return the page rendered as a base64-encoded JPEG string along with `imageWidth` and `imageHeight`, without running panel detection

#### Scenario: Invalid parameters for page image
- **WHEN** a GET request to `/api/panel-detect/page-image` has an invalid volume ID or out-of-range page number
- **THEN** the response SHALL return a 400 or 404 error with a descriptive message
