## MODIFIED Requirements

### Requirement: Unit thumbnails resolve through a manual-override → page-1 → placeholder chain

The system SHALL serve a manual-override cover image for a reading unit when one exists at `MANGA_DIR/<Series>/.covers/unit-<filename>.cover.jpg`, falling back to the auto-generated page-1 thumbnail at `unit-<filename>.jpg`, and finally to a number placeholder rendered by the client when both files are absent or unreadable. The resolution chain is identical for volume and chapter units; only the filename of the source file differs.

#### Scenario: Override file exists

- **WHEN** a client requests `GET /api/manga/[seriesId]/[unitId]/thumbnail` for a unit whose `.cover.jpg` override file is present
- **THEN** the system streams the override file with `Content-Type: image/jpeg`

#### Scenario: Only page-1 thumbnail exists

- **WHEN** a client requests the thumbnail for a unit with no override but with an existing `unit-<filename>.jpg`
- **THEN** the system streams the page-1 thumbnail with `Content-Type: image/jpeg`

#### Scenario: No cached image exists

- **WHEN** a client requests the thumbnail for a unit with neither file cached
- **THEN** the system extracts page 1 of the underlying file, caches it as `unit-<filename>.jpg`, and streams the result

#### Scenario: Unit file is missing on disk

- **WHEN** a client requests the thumbnail for a unit whose underlying file is not on disk and no cached images exist
- **THEN** the system returns a 404 error so the client can fall back to the number placeholder

### Requirement: Admin can auto-generate a series cover from page 1 of the first unit

The system SHALL provide an API endpoint that renders page 1 of the lowest-numbered unit in the series and saves it as the series cover.

#### Scenario: Generate from first unit

- **WHEN** an admin sends `POST /api/manga/[seriesId]/cover/generate`
- **THEN** the system locates the unit with the lowest `unit_number`, extracts its page 1 via the format-aware `PageSource` abstraction, encodes it as JPEG, saves it to `.covers/cover.jpg`, and updates `series.cover_path`

#### Scenario: Series has no units

- **WHEN** an admin sends the request for a series with no units
- **THEN** the system returns a 400 error

### Requirement: Admin can upload a cover override for an individual unit via file or URL

The system SHALL provide an API endpoint mirroring the series cover endpoint but scoped to a single reading unit, saving the uploaded image at `MANGA_DIR/<Series>/.covers/unit-<filename>.cover.jpg`. The endpoint accepts volume or chapter units interchangeably.

#### Scenario: Upload a unit cover file

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[unitId]/cover` with multipart `cover` file
- **THEN** the system writes the file to the unit's `.cover.jpg` override path and returns `{ success: true }`

#### Scenario: Set unit cover from URL

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[unitId]/cover` with JSON `{ "url": "https://..." }`
- **THEN** the system downloads the URL server-side under the same 10MB / image-only validation as the series endpoint and saves it to the unit's override path

#### Scenario: Unit not found

- **WHEN** an admin sends the request for a unit that does not exist or does not belong to the given series
- **THEN** the system returns a 404 error

### Requirement: Admin can regenerate the page-1 thumbnail for an individual unit

The system SHALL provide an API endpoint that re-renders page 1 of the unit and refreshes the page-1 thumbnail cache, without affecting any manual-override `.cover.jpg` file.

#### Scenario: Regenerate page-1

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[unitId]/cover/generate`
- **THEN** the system extracts page 1 of the unit file via `PageSource`, writes it to `unit-<filename>.jpg`, and returns `{ success: true }`

#### Scenario: Override is preserved

- **WHEN** an admin regenerates page-1 for a unit that has a `.cover.jpg` override
- **THEN** the override file is unchanged and the next thumbnail request still returns the override

### Requirement: Admin can auto-fetch a per-volume cover from MangaDex

The system SHALL provide an API endpoint that downloads the MangaDex cover whose `volume` matches the unit number, saving it as the unit's `.cover.jpg` override. This endpoint is meaningful only for units belonging to a series with `kind='volume'`; for chapter series it returns 400 because MangaDex does not index covers by chapter.

#### Scenario: Cover exists on MangaDex (volume series)

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[unitId]/cover/generate-web` for a unit whose parent series has `kind='volume'`, a `mangadex_id`, and whose `unit_number` has a matching MangaDex cover
- **THEN** the system downloads the matching cover (preferring `en` locale, then `ja`, then any) and saves it to `unit-<filename>.cover.jpg`

#### Scenario: No matching cover on MangaDex (volume series)

- **WHEN** the MangaDex cover endpoint returns no entries matching the unit number
- **THEN** the system returns a 404 error so the client can show a "no cover available" message; the existing thumbnail is unchanged

#### Scenario: Series not linked to MangaDex

- **WHEN** an admin sends the request for a unit whose parent series has `mangadex_id` null
- **THEN** the system returns a 400 error indicating the series must be linked first

#### Scenario: Unit has no unit_number

- **WHEN** an admin sends the request for a unit with `unit_number` null
- **THEN** the system returns a 400 error indicating the unit number is required

#### Scenario: Chapter series unit

- **WHEN** an admin sends the request for a unit whose parent series has `kind='chapter'`
- **THEN** the system returns a 400 error indicating that per-unit MangaDex covers are only available for volume series

### Requirement: Cover override is preserved across bulk operations

The system SHALL skip units that already have a `.cover.jpg` override file when performing bulk MangaDex cover fetches, regardless of whether the override was set via file upload, URL, or a previous web fetch.

#### Scenario: Bulk fetch skips existing override

- **WHEN** a bulk-fetch operation encounters a unit with an existing `.cover.jpg` override
- **THEN** the system does NOT contact MangaDex for that unit and does NOT overwrite the file

#### Scenario: Bulk fetch fills missing covers (volume series only)

- **WHEN** a bulk-fetch operation encounters a unit with no `.cover.jpg` override in a volume series
- **THEN** the system attempts a MangaDex fetch and saves the result to the override path

### Requirement: Library admin UI exposes cover management via a shared menu

The system SHALL render a 3-dot overlay menu on series cards in the library grid AND on unit tiles in the unit grid, exclusively when admin mode is active. The menu SHALL offer four actions: Upload Cover, Set from URL, Auto-generate (page 1), Auto-generate from web (MangaDex).

#### Scenario: Admin sees menu on series card

- **WHEN** an admin hovers a series card in the library grid with admin mode active
- **THEN** a 3-dot button appears, and clicking it opens a menu with all four actions

#### Scenario: Admin sees menu on unit tile

- **WHEN** an admin hovers a unit tile in the unit grid with admin mode active
- **THEN** the same 3-dot menu pattern appears, scoped to that unit

#### Scenario: Non-admin sees no menu

- **WHEN** a regular user views the library or a series page
- **THEN** no 3-dot menu appears on any cover surface

#### Scenario: Auto-generate from web is disabled when unlinked

- **WHEN** the relevant series has `mangadex_id` null (whether viewing a series card or a unit tile)
- **THEN** the "Auto-generate from web" menu item is rendered in a disabled state with an explanatory tooltip directing the user to run Fetch Metadata first

#### Scenario: Auto-generate from web is disabled on chapter-series units

- **WHEN** a unit tile belongs to a series with `kind='chapter'`
- **THEN** the "Auto-generate from web" menu item is rendered in a disabled state with an explanatory tooltip saying per-chapter covers are not available on MangaDex

#### Scenario: Auto-generate from web is enabled for volume series with link

- **WHEN** the relevant series has `kind='volume'` and a non-null `mangadex_id`
- **THEN** the "Auto-generate from web" menu item is enabled and clicking it triggers the appropriate `cover/generate-web` endpoint

### Requirement: Cover storage uses a stable, format-aware naming convention

The system SHALL store cover and thumbnail files inside the per-series `.covers/` directory using filenames that distinguish the series cover, the page-1 thumbnail, and the manual-override cover for each reading unit. Unit storage paths use the `unit-` prefix regardless of whether the unit is a volume or a chapter.

#### Scenario: Series cover path

- **WHEN** the system needs to read or write a series cover
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/cover.jpg`

#### Scenario: Unit page-1 thumbnail path

- **WHEN** the system needs to read or write a unit's page-1 thumbnail
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/unit-<sanitized-filename>.jpg`, where the file extension of the source file is preserved (so `Vol01.pdf` and `Vol01.cbz` map to distinct files)

#### Scenario: Unit manual-override cover path

- **WHEN** the system needs to read or write a unit's manual-override cover
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/unit-<sanitized-filename>.cover.jpg`, sharing the same sanitization rules as the page-1 thumbnail

#### Scenario: Legacy vol- prefixed thumbnail files are orphaned

- **WHEN** legacy `vol-<filename>.jpg` or `vol-<filename>.cover.jpg` files exist on disk from before this change
- **THEN** they remain on disk and the system regenerates new `unit-<filename>.jpg` files on next access; the legacy files have no effect on resolution
