## ADDED Requirements

### Requirement: Series has a kind discriminator

Each series SHALL carry a `kind` value of either `'volume'` or `'chapter'`, persisted as a column on the `series` table. The column SHALL default to `'volume'` for backwards compatibility with existing rows.

#### Scenario: Existing series row after migration

- **WHEN** the database is migrated from a pre-chapter schema
- **THEN** every existing `series` row receives `kind = 'volume'`

#### Scenario: New series with chapter folder layout

- **WHEN** the scanner creates a new series row for a folder containing a `chapters/` subfolder with files
- **THEN** the inserted row has `kind = 'chapter'`

#### Scenario: New series with flat layout

- **WHEN** the scanner creates a new series row for a folder containing flat `.pdf`/`.cbz` files
- **THEN** the inserted row has `kind = 'volume'`

### Requirement: Folder convention determines series kind

The scanner SHALL classify a series as `kind='chapter'` when its folder contains a subdirectory named `chapters` (matched case-insensitively) with at least one supported file inside, and as `kind='volume'` otherwise. The convention is asymmetric: no `volumes/` subfolder is recognised — flat layout is the volume convention.

#### Scenario: Chapter series folder

- **WHEN** `MANGA_DIR/Chainsaw Man/chapters/Chapter 001.cbz` exists
- **THEN** the series `Chainsaw Man` is created with `kind = 'chapter'` and the file is registered as one of its reading units

#### Scenario: Case-insensitive folder name

- **WHEN** the subfolder is named `Chapters/` or `CHAPTERS/` instead of `chapters/`
- **THEN** it is treated identically and the series is classified as `kind = 'chapter'`

#### Scenario: Volume series stays flat

- **WHEN** `MANGA_DIR/One Piece/Volume 01.cbz` exists at the series folder root
- **THEN** the series `One Piece` is created with `kind = 'volume'`

#### Scenario: Symmetric volumes/ subfolder is not recognised

- **WHEN** a series folder contains a `volumes/` subdirectory with files
- **THEN** the scanner SHALL NOT enter the `volumes/` subdirectory; only flat files are registered as volume units

### Requirement: Kind is fixed at series creation

The scanner SHALL set `series.kind` exactly once, when the series row is first inserted. Subsequent scans SHALL NOT change the kind of an existing series even if the folder layout changes.

#### Scenario: Folder layout changes after series creation

- **WHEN** a series was first scanned as `kind='volume'` and the user later adds a `chapters/` subfolder with files
- **THEN** the series row still reports `kind='volume'`; the scanner does not flip the kind

#### Scenario: Kind change requires explicit reclassification

- **WHEN** a user wants to change a series's kind
- **THEN** they must use the admin reclassify action; the scanner alone does not effect the change

### Requirement: Empty chapters folder does not materialize a series

The scanner SHALL NOT insert a `series` row for a series folder whose only content is an empty `chapters/` subfolder (or one containing only files of unrecognised extensions).

#### Scenario: Empty chapters folder

- **WHEN** `MANGA_DIR/Foo/chapters/` exists but contains zero `.pdf` or `.cbz` files
- **THEN** no `series` row is created for `Foo`

#### Scenario: Chapters folder with only unrecognised files

- **WHEN** `MANGA_DIR/Foo/chapters/` contains only files with unrecognised extensions (e.g., `.txt`, `.zip`)
- **THEN** no `series` row is created for `Foo`

### Requirement: Collision between flat files and chapters subfolder defers to existing kind

When a series folder contains both flat files AND a `chapters/` subfolder with files, the scanner SHALL preserve whatever `kind` is already stored in the database for that series, register only the files matching that kind, and log a warning naming the ignored source. For a brand-new series with both layouts present, flat files SHALL be the chosen source (volume kind).

#### Scenario: Existing volume series gains a chapters subfolder

- **WHEN** a series with existing `kind='volume'` has new files added under `chapters/` as well
- **THEN** the scanner registers any new flat files as additional volume units, ignores the files inside `chapters/`, and logs a warning

#### Scenario: Existing chapter series gains a flat file

- **WHEN** a series with existing `kind='chapter'` has a new file added at the series folder root
- **THEN** the scanner registers any new files inside `chapters/` as additional chapter units, ignores the flat file, and logs a warning

#### Scenario: Brand-new series with both layouts present

- **WHEN** a series folder contains both flat files and a non-empty `chapters/` subfolder, and no `series` row exists yet
- **THEN** the scanner creates the series with `kind='volume'`, registers only the flat files, and logs a warning that the `chapters/` subfolder was ignored

### Requirement: Filename number extraction branches by series kind

The scanner SHALL extract a unit number from each filename using vocabulary appropriate to the series's kind. Volume vocabulary matches `vol|v|#|trailing-number`. Chapter vocabulary matches `chapter|ch|#|trailing-number`. The `#` and trailing-number patterns are shared; the keyword patterns are kind-specific.

#### Scenario: Volume series with volume-keyword filename

- **WHEN** a volume series contains `Series Volume 03.cbz`
- **THEN** `unit_number` is extracted as `3`

#### Scenario: Chapter series with chapter-keyword filename

- **WHEN** a chapter series contains `Series Chapter 047.cbz`
- **THEN** `unit_number` is extracted as `47`

#### Scenario: Chapter series with short chapter prefix

- **WHEN** a chapter series contains `Series Ch 047.cbz` or `Series ch047.cbz`
- **THEN** `unit_number` is extracted as `47`

#### Scenario: Trailing number fallback shared between kinds

- **WHEN** a series file is named `Series 047.cbz` (no keyword)
- **THEN** `unit_number` is extracted as `47` regardless of series kind

#### Scenario: Volume keyword does not extract in a chapter series

- **WHEN** a chapter series contains an oddly-named file `Series Volume 03.cbz` (mis-placed in a chapter series folder)
- **THEN** the scanner does NOT match the `volume` keyword; it falls back to the trailing-number heuristic and extracts `3`

### Requirement: UI labels are kind-aware

The series detail page and reader UI SHALL render different label nouns based on `series.kind`. Volume kinds use "Volume(s)" copy; chapter kinds use "Chapter(s)" copy. The mechanical behavior (sorting, navigation, progress aggregation) is identical between kinds — only the noun differs.

#### Scenario: Volume series headers and counts

- **WHEN** a user views a series detail page for a series with `kind='volume'`
- **THEN** the units section header reads "Volumes" and the count reads "X volumes"

#### Scenario: Chapter series headers and counts

- **WHEN** a user views a series detail page for a series with `kind='chapter'`
- **THEN** the units section header reads "Chapters" and the count reads "X chapters"

#### Scenario: Continue-reading button copy

- **WHEN** the user has progress in a chapter-series unit and views the continue button
- **THEN** the button copy uses chapter terminology (e.g., "Continue Chapter X") rather than "Continue Vol. X"

#### Scenario: End-of-unit overlay copy

- **WHEN** a user reaches the last page of a unit in a chapter series and the overlay appears
- **THEN** the overlay copy says "Continue to Ch. X" / "Series Complete" using chapter vocabulary

### Requirement: Admin can reclassify a series to flip its kind

The system SHALL expose an admin-only endpoint that flips `series.kind` to the opposite value and drops the `reading_units` and reading-progress rows for that series. The endpoint SHALL require explicit confirmation context from the client.

#### Scenario: Reclassify a volume series to chapter

- **WHEN** an admin sends `POST /api/manga/[seriesId]/reclassify` for a series with `kind='volume'`
- **THEN** the system sets `kind='chapter'`, deletes all `reading_units` rows for the series, deletes associated `reading_progress` rows, and returns the updated series record

#### Scenario: Reclassify a chapter series to volume

- **WHEN** an admin sends `POST /api/manga/[seriesId]/reclassify` for a series with `kind='chapter'`
- **THEN** the system sets `kind='volume'`, deletes all `reading_units` rows, deletes associated `reading_progress` rows, and returns the updated series record

#### Scenario: Non-admin attempts reclassify

- **WHEN** a non-admin client sends the reclassify request
- **THEN** the system rejects the request with a 403 (or whatever the existing admin-gate uses)

#### Scenario: Series not found

- **WHEN** the reclassify endpoint is called with a series ID that does not exist
- **THEN** the system returns a 404 error and changes nothing

### Requirement: Reclassify confirmation UI warns about progress loss

The series detail page SHALL render an admin-only "Reclassify series" button that, when pressed, confirms with the user that reading progress for the series will be lost before invoking the reclassify endpoint. The UI SHALL also remind the user to move files in the filesystem so the next scan repopulates units correctly.

#### Scenario: Admin presses Reclassify

- **WHEN** an admin presses the "Reclassify series" button on the series detail page
- **THEN** a confirmation dialog appears stating that all reading progress for this series will be deleted and that the user must move files between `chapters/` and the series root manually

#### Scenario: Admin confirms reclassify

- **WHEN** the admin confirms the dialog
- **THEN** the client invokes `POST /api/manga/[seriesId]/reclassify` and on success refreshes the series detail page

#### Scenario: Admin dismisses reclassify

- **WHEN** the admin dismisses the dialog
- **THEN** no request is sent and the series is unchanged

#### Scenario: Reclassify button is not visible to non-admins

- **WHEN** a non-admin user views the series detail page
- **THEN** the "Reclassify series" button is not rendered
