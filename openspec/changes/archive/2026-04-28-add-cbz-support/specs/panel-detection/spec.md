## ADDED Requirements

### Requirement: Panel detection accepts any registered volume format

Panel detection endpoints SHALL operate on volumes regardless of underlying file format (`pdf` or `cbz`), routing page-image acquisition through the format-agnostic page-source abstraction rather than calling PDF tools directly.

#### Scenario: Panel detection on a CBZ volume

- **WHEN** a `POST /api/panel-detect` request is sent referencing a volume whose `format` is `'cbz'` with a valid page number
- **THEN** the response SHALL contain panel detection results computed from the corresponding image entry in the archive

#### Scenario: Page-image endpoint for a CBZ volume

- **WHEN** a `GET /api/panel-detect/page-image` request is sent for a CBZ volume
- **THEN** the response SHALL include `pageImage` (base64-encoded JPEG), `imageWidth`, and `imageHeight` derived from the corresponding archive entry

#### Scenario: PDF behaviour preserved

- **WHEN** the same endpoints are called against a PDF volume
- **THEN** the responses SHALL match the existing PDF-path behaviour byte-for-byte (no regression)

#### Scenario: Out-of-range page number for CBZ

- **WHEN** a request specifies a page number greater than the count of image entries in a CBZ volume
- **THEN** the response SHALL return a 400 or 404 error with a descriptive message
