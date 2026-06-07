## ADDED Requirements

### Requirement: Each series has a kind detected from the filesystem and fixed at creation

The system SHALL record a `kind` of `'volume'` or `'chapter'` on every series. The `series.kind` column SHALL default to `'volume'`. The scanner SHALL set `kind` only when it first creates a series row and SHALL NOT recompute it on any later scan. A series whose folder contains a `chapters/` subdirectory holding at least one supported file (`.pdf` or `.cbz`, case-insensitive) SHALL be created as a chapter series; any other series SHALL be created as a volume series.

#### Scenario: Series folder with a chapters subdirectory becomes a chapter series

- **WHEN** the scanner first encounters a series folder containing `chapters/` with one or more supported files
- **THEN** the series row is created with `kind = 'chapter'` and its reading units are enumerated from the files inside `chapters/`

#### Scenario: Series folder with flat files becomes a volume series

- **WHEN** the scanner first encounters a series folder with supported files at its root and no populated `chapters/` subdirectory
- **THEN** the series row is created with `kind = 'volume'` and its reading units are enumerated from the flat files, exactly as before this change

#### Scenario: Existing series default to volume

- **WHEN** the schema migration adds the `kind` column to a database that already contains series rows
- **THEN** every existing series row has `kind = 'volume'` and its rendering, sort, URLs, cover paths, and progress keys are unchanged

#### Scenario: Kind is not recomputed on rescan

- **WHEN** a series already exists in the database and the scanner runs again, even if a `chapters/` subdirectory has since been added or removed
- **THEN** the series keeps the `kind` it was created with

#### Scenario: Folder with both flat files and a chapters subdirectory

- **WHEN** the scanner first encounters a series folder that has both supported flat files and a populated `chapters/` subdirectory
- **THEN** the series is created with `kind = 'chapter'`, its units come from `chapters/`, the flat files are ignored, and a warning is logged

### Requirement: Chapter reading units store their chapters-prefixed path in the filename column

The system SHALL store a chapter unit's `filename` as the path relative to the series folder including the `chapters/` prefix (e.g. `chapters/Ch 10.5.cbz`), so that existing file-resolution and cover-cache-key logic resolves chapter files without modification. File→pages mechanics (the volume-file stream, page extraction, thumbnail generation, and panel detection) SHALL be identical between volume and chapter units.

#### Scenario: Chapter file resolves through the existing path join

- **WHEN** any consumer resolves a chapter unit's file via `path.join(MANGA_DIR, series.folder_name, unit.filename)`
- **THEN** the resulting path points at the file inside the series `chapters/` directory and the volume-file stream, page extraction, and panel detection behave the same as for a volume unit

#### Scenario: Chapter thumbnail cache key stays flat and collision-free

- **WHEN** a chapter unit's thumbnail or override cache key is derived from its `filename`
- **THEN** the `chapters/` separator is sanitized into the key (producing a flat file under the series-root `.covers/` directory) and does not collide with any volume unit's cache key

### Requirement: Chapter numbers are extracted with decimal support and sorted numerically

The system SHALL extract a possibly-fractional number for each chapter unit from its filename, supporting values such as `10.5`. The reading-unit number column SHALL store this value as `REAL` so that units sort numerically (`10 < 10.5 < 11`). Volume number extraction SHALL be unchanged, and existing whole-number values SHALL be unaffected by the column widening.

#### Scenario: Decimal chapter number is extracted and stored

- **WHEN** the scanner enumerates a chapter file named so that a number like `10.5` is present (e.g. `Chapter 10.5`, `Ch 10.5`, `#10.5`)
- **THEN** the unit's number is stored as `10.5`

#### Scenario: Chapter units sort numerically including decimals

- **WHEN** a chapter series contains units numbered `10`, `10.5`, and `11`
- **THEN** they are listed in the order `10`, `10.5`, `11`

#### Scenario: Volume numbers and sort are unchanged

- **WHEN** a volume series is scanned after the number column is widened to `REAL`
- **THEN** its volume numbers and ordering are identical to before this change

### Requirement: Reading-unit labels are kind-aware and leave volume output unchanged

The system SHALL label reading units according to their series kind through a shared helper: volume units SHALL render with the existing "Vol." wording and chapter units SHALL render with "Ch." wording (e.g. `Ch. 10.5`). The helper's volume branch SHALL produce output byte-identical to the wording used before this change, across the library tiles, progress text, continue-reading entries, the continue button, the reader chrome, and the end-of-unit overlay.

#### Scenario: Chapter unit shows a chapter label

- **WHEN** a unit belonging to a chapter series is displayed in the library or reader
- **THEN** its label uses "Ch." with the unit's number (e.g. `Ch. 10.5`), and the end-of-unit overlay reads "End of Chapter"

#### Scenario: Volume unit label is unchanged

- **WHEN** a unit belonging to a volume series is displayed anywhere it was displayed before this change
- **THEN** its label is the exact same string as before (e.g. `Vol. 3`), and the end-of-unit overlay reads "End of Volume"

### Requirement: The series detail page renders chapter series as a list and volume series as a grid

On the series detail page, the system SHALL render a volume-kind series' units as the existing cover-tile grid and a chapter-kind series' units as a vertical list of rows. Each chapter row SHALL show the unit's "Ch." label, link to the reader, and reflect reading progress (in-progress and completed states).

#### Scenario: Chapter series renders as a list

- **WHEN** the detail page for a chapter-kind series with one or more units is displayed
- **THEN** the units are rendered as a vertical list of rows (not the cover-tile grid), each labeled with its "Ch." number and linking to the reader

#### Scenario: Volume series still renders as a grid

- **WHEN** the detail page for a volume-kind series is displayed
- **THEN** the units are rendered as the cover-tile grid exactly as before this change
