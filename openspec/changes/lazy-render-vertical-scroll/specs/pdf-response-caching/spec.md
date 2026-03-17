## ADDED Requirements

### Requirement: Browser caching of PDF responses
The PDF delivery endpoint SHALL include cache headers so that repeat requests for the same volume are served from browser cache.

#### Scenario: PDF response includes cache headers
- **WHEN** a client requests a PDF via `/api/manga/[seriesId]/[volumeId]/pdf`
- **THEN** the response SHALL include `Cache-Control: private, max-age=86400`

#### Scenario: Repeat open of same volume uses browser cache
- **WHEN** a user opens the same manga volume a second time within 24 hours
- **THEN** the browser SHALL serve the PDF from cache without a server request
