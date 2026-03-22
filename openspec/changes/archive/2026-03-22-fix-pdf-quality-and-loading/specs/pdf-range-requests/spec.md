## ADDED Requirements

### Requirement: PDF route advertises range request support
The PDF streaming API route SHALL include `Accept-Ranges: bytes` and `Content-Length` headers on every response so that HTTP clients (including pdfjs-dist) know they can issue partial-content requests.

#### Scenario: Full file request includes range headers
- **WHEN** a client fetches `/api/manga/[seriesId]/[volumeId]/pdf` without a `Range` header
- **THEN** the response SHALL be `200 OK` with `Accept-Ranges: bytes` and `Content-Length: <filesize>` headers

### Requirement: PDF route handles partial content requests
The PDF streaming API route SHALL respond to `Range: bytes=X-Y` requests with `206 Partial Content`, streaming only the requested byte slice.

#### Scenario: Valid range request
- **WHEN** a client sends `Range: bytes=0-65535`
- **THEN** the response SHALL be `206 Partial Content` with `Content-Range: bytes 0-65535/<total>`, `Content-Length: 65536`, and the requested byte slice in the body

#### Scenario: Open-ended range request
- **WHEN** a client sends `Range: bytes=131072-` (no end byte)
- **THEN** the response SHALL stream from byte 131072 to the end of the file with an appropriate `Content-Range` header

#### Scenario: Invalid range request
- **WHEN** a client sends a `Range` header with a start byte beyond the file size
- **THEN** the response SHALL be `416 Range Not Satisfiable` with `Content-Range: bytes */<total>`

#### Scenario: pdfjs loads only needed pages
- **WHEN** pdfjs-dist opens a PDF via the streaming route
- **THEN** it SHALL issue range requests to fetch only the cross-reference table and the pages it needs to render, rather than downloading the full file
