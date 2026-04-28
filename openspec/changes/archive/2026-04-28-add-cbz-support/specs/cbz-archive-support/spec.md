## ADDED Requirements

### Requirement: Manga directory layout is flat per series

Volume files SHALL live directly inside their series directory under `MANGA_DIR`, one volume per file, with no nested per-volume sub-directories. The structure SHALL be `MANGA_DIR/<Series>/<Volume>.{pdf|cbz}`.

#### Scenario: CBZ files sit alongside PDF files in a series

- **WHEN** a series directory contains a mix of `.pdf` and `.cbz` files at its top level
- **THEN** each file SHALL be registered as a separate volume of the same series

#### Scenario: Nested volume directories are not volumes

- **WHEN** a series directory contains a sub-directory (other than the hidden `.covers/` cache) holding image files
- **THEN** the scanner SHALL NOT register the sub-directory as a volume; image-folder volumes are out of scope

#### Scenario: Hidden caches preserved

- **WHEN** a series directory contains a `.covers/` sub-directory
- **THEN** the scanner SHALL ignore it (it is the existing thumbnail cache and not a volume)

### Requirement: Volume thumbnail cache key is collision-free across formats

Cached volume thumbnails SHALL be keyed in a way that two volumes in the same series with the same stem but different formats (e.g., `Vol01.pdf` and `Vol01.cbz`) resolve to distinct cache files.

#### Scenario: Same stem, different formats

- **WHEN** a series contains both `Vol01.pdf` and `Vol01.cbz`
- **THEN** their generated thumbnail paths under `.covers/` SHALL be distinct (the file extension SHALL be encoded into the cache key, not stripped)

#### Scenario: Existing PDF cache keys

- **WHEN** computing the thumbnail path for an existing PDF volume after this change
- **THEN** the resulting filename MAY differ from before (a one-time re-generation is acceptable; cached thumbnails are derived data)

### Requirement: Recognised volume formats

The system SHALL recognise volumes in two formats: PDF (`.pdf`) and CBZ (`.cbz`, a ZIP archive of per-page raster images). File-format recognition SHALL be case-insensitive on the file extension.

#### Scenario: PDF volume in manga directory

- **WHEN** the manga directory contains `<Series>/Vol01.pdf`
- **THEN** the scanner SHALL register the volume with `format = 'pdf'`

#### Scenario: CBZ volume in manga directory

- **WHEN** the manga directory contains `<Series>/Vol01.cbz`
- **THEN** the scanner SHALL register the volume with `format = 'cbz'`

#### Scenario: Mixed-format series

- **WHEN** a series folder contains both `.pdf` and `.cbz` files
- **THEN** each file SHALL be registered as its own volume with the appropriate `format`

#### Scenario: Unrecognised extension

- **WHEN** the manga directory contains a file with an extension other than `.pdf` or `.cbz` (e.g., `.cbr`, `.zip`, `.epub`)
- **THEN** the scanner SHALL ignore the file and not register a volume

### Requirement: Volume format is persisted on the volume row

The `volumes` table SHALL include a `format` column whose value is `'pdf'` or `'cbz'`, populated by the scanner when the row is inserted.

#### Scenario: New CBZ volume scanned

- **WHEN** a new `.cbz` file is scanned and inserted into `volumes`
- **THEN** the row's `format` column SHALL contain `'cbz'`

#### Scenario: Existing rows after upgrade

- **WHEN** the schema migration adds the `format` column to a database whose existing rows predate the column
- **THEN** existing rows SHALL receive the default value `'pdf'`

#### Scenario: Volume API responses include format

- **WHEN** a client requests a volume via the manga listing or detail API
- **THEN** the response SHALL include a `format` field reflecting the column value

### Requirement: Volume number extraction is extension-agnostic

The volume-number heuristic that runs on file names SHALL work regardless of file extension and SHALL strip any recognised extension when computing the title.

#### Scenario: CBZ filename with volume number

- **WHEN** the file is named `Series Volume 03.cbz`
- **THEN** `volume_number` SHALL be `3` and `title` SHALL be `Series Volume 03`

#### Scenario: PDF filename with volume number unchanged behaviour

- **WHEN** the file is named `Series Volume 03.pdf`
- **THEN** `volume_number` and `title` SHALL be computed identically to before this change

### Requirement: CBZ entries are sorted naturally and filtered to images

When reading a CBZ archive, the system SHALL enumerate its entries in natural (numeric-aware, case-insensitive) order, and SHALL include only image entries.

#### Scenario: Numeric ordering across digit widths

- **WHEN** an archive contains `page_1.jpg`, `page_2.jpg`, `page_10.jpg`
- **THEN** the page order SHALL be `page_1.jpg`, `page_2.jpg`, `page_10.jpg` (not lexicographic)

#### Scenario: Recognised image types

- **WHEN** an archive contains entries with extensions `.jpg`, `.jpeg`, `.png`, `.webp`, or `.avif`
- **THEN** all such entries SHALL be treated as pages

#### Scenario: Non-image entries skipped

- **WHEN** an archive contains `ComicInfo.xml`, `Thumbs.db`, files inside `__MACOSX/`, or any entry whose name begins with a `.`
- **THEN** those entries SHALL be ignored when computing page count and order

#### Scenario: Directories skipped

- **WHEN** an archive contains directory entries
- **THEN** directories SHALL not be counted as pages

### Requirement: Server-side page extraction works for both formats

The server-side page-extraction abstraction SHALL accept any registered volume and return a page image as a byte buffer, regardless of underlying format.

#### Scenario: Extracting a page from a PDF volume

- **WHEN** the abstraction is invoked for a PDF volume with page number N
- **THEN** it SHALL return the rendered page as image bytes (existing behaviour preserved)

#### Scenario: Extracting a page from a CBZ volume

- **WHEN** the abstraction is invoked for a CBZ volume with page number N
- **THEN** it SHALL return the bytes of the N-th image entry (1-based) in natural sort order

#### Scenario: Page number out of range

- **WHEN** the requested page number is less than 1 or greater than the volume's page count
- **THEN** the abstraction SHALL throw an error rather than return an unrelated page

#### Scenario: DPI parameter for raster sources

- **WHEN** a DPI option is supplied for a CBZ-backed extraction
- **THEN** the option SHALL be ignored and the entry SHALL be returned at its native resolution

### Requirement: Thumbnail generation works for CBZ volumes

The volume thumbnail endpoint SHALL produce a thumbnail for CBZ volumes using the first image entry of the archive.

#### Scenario: First-time CBZ thumbnail

- **WHEN** a thumbnail is requested for a CBZ volume that has no cached thumbnail
- **THEN** the endpoint SHALL extract the first image entry, derive a JPEG thumbnail, cache it under `.covers/`, and return it

#### Scenario: Cached CBZ thumbnail

- **WHEN** a thumbnail has already been cached for a CBZ volume
- **THEN** the endpoint SHALL return the cached file without re-opening the archive

### Requirement: Streaming endpoint serves both formats

The `/api/manga/[seriesId]/[volumeId]/pdf` route SHALL stream the underlying volume file with the correct `Content-Type` for its format, and SHALL preserve range-request behaviour.

#### Scenario: PDF volume streamed

- **WHEN** the volume's `format` is `'pdf'`
- **THEN** the response `Content-Type` SHALL be `application/pdf`

#### Scenario: CBZ volume streamed

- **WHEN** the volume's `format` is `'cbz'`
- **THEN** the response `Content-Type` SHALL be `application/vnd.comicbook+zip`

#### Scenario: Range requests for CBZ

- **WHEN** a client issues a `Range: bytes=START-END` header for a CBZ volume
- **THEN** the endpoint SHALL respond with status 206 and the requested byte slice (same handling as PDF)

### Requirement: Reader renders CBZ volumes

The client reader SHALL render volumes whose `format` is `'cbz'` by fetching the archive, parsing entries, and drawing the per-page images onto its canvases.

#### Scenario: Loading a CBZ volume

- **WHEN** the reader opens a volume whose `format` is `'cbz'`
- **THEN** the reader SHALL fetch the archive bytes, parse entries with a ZIP library, expose a page count equal to the number of image entries, and render each page on its canvas

#### Scenario: Page rendering parity

- **WHEN** the reader renders a CBZ page
- **THEN** the rendered output SHALL fit the available canvas dimensions using the same width/height fitting logic used for PDF pages

#### Scenario: Reader features apply uniformly

- **WHEN** a CBZ volume is open
- **THEN** zoom, pan, vertical/horizontal mode, smart panel zoom, progress persistence, and prev/next-volume navigation SHALL behave the same as for PDF volumes

#### Scenario: Failure to open archive

- **WHEN** the archive is corrupt, encrypted, or contains zero recognisable image entries
- **THEN** the reader SHALL display a load error rather than a blank or broken page

### Requirement: Out-of-scope archive variants

The system SHALL NOT attempt to read encrypted ZIPs, RAR archives (`.cbr`), or `ComicInfo.xml` metadata as part of CBZ support.

#### Scenario: Encrypted CBZ

- **WHEN** a CBZ archive requires a password to extract
- **THEN** opening it SHALL fail with a clear error rather than silently degrading

#### Scenario: RAR archive named `.cbz`

- **WHEN** a file named `.cbz` is internally a RAR archive
- **THEN** opening it SHALL fail with a clear error
