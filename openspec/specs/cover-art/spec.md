# cover-art Specification

## Purpose

TBD - created by archiving change add-volume-covers. Update Purpose after archive.

## Requirements

### Requirement: Volume thumbnails resolve through a manual-override → page-1 → placeholder chain

The system SHALL serve a manual-override cover image for a volume when one exists at `MANGA_DIR/<Series>/.covers/vol-<filename>.cover.jpg`, falling back to the auto-generated page-1 thumbnail at `vol-<filename>.jpg`, and finally to a number placeholder rendered by the client when both files are absent or unreadable.

#### Scenario: Override file exists

- **WHEN** a client requests `GET /api/manga/[seriesId]/[volumeId]/thumbnail` for a volume whose `.cover.jpg` override file is present
- **THEN** the system streams the override file with `Content-Type: image/jpeg`

#### Scenario: Only page-1 thumbnail exists

- **WHEN** a client requests the thumbnail for a volume with no override but with an existing `vol-<filename>.jpg`
- **THEN** the system streams the page-1 thumbnail with `Content-Type: image/jpeg`

#### Scenario: No cached image exists

- **WHEN** a client requests the thumbnail for a volume with neither file cached
- **THEN** the system extracts page 1 of the underlying volume file, caches it as `vol-<filename>.jpg`, and streams the result

#### Scenario: Volume file is missing on disk

- **WHEN** a client requests the thumbnail for a volume whose underlying file is not on disk and no cached images exist
- **THEN** the system returns a 404 error so the client can fall back to the number placeholder

### Requirement: Admin can upload a cover image for a series via file or URL

The system SHALL provide an API endpoint that accepts a multipart `cover` file upload OR a JSON body containing a `url` to fetch, and saves the result as the series cover.

#### Scenario: Upload a cover file

- **WHEN** an admin sends `POST /api/manga/[seriesId]/cover` with `multipart/form-data` containing a `cover` file
- **THEN** the system writes the file to `.covers/cover.jpg`, updates `series.cover_path`, and returns `{ success: true }`

#### Scenario: Set cover from URL

- **WHEN** an admin sends `POST /api/manga/[seriesId]/cover` with a JSON body `{ "url": "https://..." }`
- **THEN** the system downloads the URL server-side, validates it is an image of at most 10MB, saves it as the series cover, and returns `{ success: true }`

#### Scenario: URL is not an image

- **WHEN** an admin sends a URL whose `Content-Type` does not start with `image/`
- **THEN** the system returns a 400 error and does not modify the series cover

#### Scenario: URL exceeds size limit

- **WHEN** an admin sends a URL whose downloaded body exceeds 10MB
- **THEN** the system returns a 400 error and does not modify the series cover

#### Scenario: URL scheme is invalid

- **WHEN** an admin sends a URL that is not `http://` or `https://`
- **THEN** the system returns a 400 error

### Requirement: Admin can auto-generate a series cover from page 1 of the first volume

The system SHALL provide an API endpoint that renders page 1 of the lowest-numbered volume in the series and saves it as the series cover.

#### Scenario: Generate from first volume

- **WHEN** an admin sends `POST /api/manga/[seriesId]/cover/generate`
- **THEN** the system locates the volume with the lowest `volume_number`, extracts its page 1 via the format-aware `PageSource` abstraction, encodes it as JPEG, saves it to `.covers/cover.jpg`, and updates `series.cover_path`

#### Scenario: Series has no volumes

- **WHEN** an admin sends the request for a series with no volumes
- **THEN** the system returns a 400 error

### Requirement: Admin can auto-fetch a series cover from MangaDex

The system SHALL provide an API endpoint that downloads the canonical MangaDex cover for the series and saves it as the series cover, when the series has a stored `mangadex_id`.

#### Scenario: Successful fetch

- **WHEN** an admin sends `POST /api/manga/[seriesId]/cover/generate-web` for a series with a non-null `mangadex_id`
- **THEN** the system queries MangaDex's cover endpoint, downloads the canonical cover (lowest volume, preferring `en` then `ja`), saves it to `.covers/cover.jpg`, and returns `{ success: true }`

#### Scenario: Series not linked to MangaDex

- **WHEN** an admin sends the request for a series with `mangadex_id` null
- **THEN** the system returns a 400 error indicating the series must be linked first

#### Scenario: MangaDex returns no cover

- **WHEN** the MangaDex cover endpoint returns no entries for the series
- **THEN** the system returns a 502 error and leaves the existing series cover unchanged

#### Scenario: MangaDex unreachable

- **WHEN** MangaDex cannot be contacted within the timeout
- **THEN** the system returns a 502 error and leaves the existing series cover unchanged

### Requirement: Admin can upload a cover override for an individual volume via file or URL

The system SHALL provide an API endpoint mirroring the series cover endpoint but scoped to a single volume, saving the uploaded image at `MANGA_DIR/<Series>/.covers/vol-<filename>.cover.jpg`.

#### Scenario: Upload a volume cover file

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[volumeId]/cover` with multipart `cover` file
- **THEN** the system writes the file to the volume's `.cover.jpg` override path and returns `{ success: true }`

#### Scenario: Set volume cover from URL

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[volumeId]/cover` with JSON `{ "url": "https://..." }`
- **THEN** the system downloads the URL server-side under the same 10MB / image-only validation as the series endpoint and saves it to the volume's override path

#### Scenario: Volume not found

- **WHEN** an admin sends the request for a volume that does not exist or does not belong to the given series
- **THEN** the system returns a 404 error

### Requirement: Admin can regenerate the page-1 thumbnail for an individual volume

The system SHALL provide an API endpoint that re-renders page 1 of the volume and refreshes the page-1 thumbnail cache, without affecting any manual-override `.cover.jpg` file.

#### Scenario: Regenerate page-1

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[volumeId]/cover/generate`
- **THEN** the system extracts page 1 of the volume file via `PageSource`, writes it to `vol-<filename>.jpg`, and returns `{ success: true }`

#### Scenario: Override is preserved

- **WHEN** an admin regenerates page-1 for a volume that has a `.cover.jpg` override
- **THEN** the override file is unchanged and the next thumbnail request still returns the override

### Requirement: Admin can auto-fetch a per-volume cover from MangaDex

The system SHALL provide an API endpoint that downloads the MangaDex cover whose `volume` matches the volume number, saving it as the volume's `.cover.jpg` override.

#### Scenario: Cover exists on MangaDex

- **WHEN** an admin sends `POST /api/manga/[seriesId]/[volumeId]/cover/generate-web` for a volume whose parent series has a `mangadex_id` and whose `volume_number` has a matching MangaDex cover
- **THEN** the system downloads the matching cover (preferring `en` locale, then `ja`, then any) and saves it to `vol-<filename>.cover.jpg`

#### Scenario: No matching cover on MangaDex

- **WHEN** the MangaDex cover endpoint returns no entries matching the volume number
- **THEN** the system returns a 404 error so the client can show a "no cover available" message; the existing thumbnail is unchanged

#### Scenario: Series not linked to MangaDex

- **WHEN** an admin sends the request for a volume whose parent series has `mangadex_id` null
- **THEN** the system returns a 400 error indicating the series must be linked first

#### Scenario: Volume has no volume_number

- **WHEN** an admin sends the request for a volume with `volume_number` null
- **THEN** the system returns a 400 error indicating the volume number is required

### Requirement: Cover override is preserved across bulk operations

The system SHALL skip volumes that already have a `.cover.jpg` override file when performing bulk MangaDex cover fetches, regardless of whether the override was set via file upload, URL, or a previous web fetch.

#### Scenario: Bulk fetch skips existing override

- **WHEN** a bulk-fetch operation encounters a volume with an existing `.cover.jpg` override
- **THEN** the system does NOT contact MangaDex for that volume and does NOT overwrite the file

#### Scenario: Bulk fetch fills missing covers

- **WHEN** a bulk-fetch operation encounters a volume with no `.cover.jpg` override
- **THEN** the system attempts a MangaDex fetch and saves the result to the override path

### Requirement: Library admin UI exposes cover management via a shared menu

The system SHALL render a 3-dot overlay menu on series cards in the library grid AND on volume tiles in the volume grid, exclusively when admin mode is active. The menu SHALL offer four actions: Upload Cover, Set from URL, Auto-generate (page 1), Auto-generate from web (MangaDex).

#### Scenario: Admin sees menu on series card

- **WHEN** an admin hovers a series card in the library grid with admin mode active
- **THEN** a 3-dot button appears, and clicking it opens a menu with all four actions

#### Scenario: Admin sees menu on volume tile

- **WHEN** an admin hovers a volume tile in the volume grid with admin mode active
- **THEN** the same 3-dot menu pattern appears, scoped to that volume

#### Scenario: Non-admin sees no menu

- **WHEN** a regular user views the library or a series page
- **THEN** no 3-dot menu appears on any cover surface

#### Scenario: Auto-generate from web is disabled when unlinked

- **WHEN** the relevant series has `mangadex_id` null (whether viewing a series card or a volume tile)
- **THEN** the "Auto-generate from web" menu item is rendered in a disabled state with an explanatory tooltip directing the user to run Fetch Metadata first

#### Scenario: Auto-generate from web is enabled when linked

- **WHEN** the relevant series has a non-null `mangadex_id`
- **THEN** the "Auto-generate from web" menu item is enabled and clicking it triggers the appropriate `cover/generate-web` endpoint

### Requirement: Cover storage uses a stable, format-aware naming convention

The system SHALL store cover and thumbnail files inside the per-series `.covers/` directory using filenames that distinguish the series cover, the page-1 thumbnail, and the manual-override cover for each volume.

#### Scenario: Series cover path

- **WHEN** the system needs to read or write a series cover
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/cover.jpg`

#### Scenario: Volume page-1 thumbnail path

- **WHEN** the system needs to read or write a volume's page-1 thumbnail
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/vol-<sanitized-filename>.jpg`, where the file extension of the source volume is preserved (so `Vol01.pdf` and `Vol01.cbz` map to distinct files)

#### Scenario: Volume manual-override cover path

- **WHEN** the system needs to read or write a volume's manual-override cover
- **THEN** it uses the path `MANGA_DIR/<folder_name>/.covers/vol-<sanitized-filename>.cover.jpg`, sharing the same sanitization rules as the page-1 thumbnail

### Requirement: Cover downloads validate content type and size

The system SHALL refuse to write any cover file produced from a remote URL when the response is not an image or exceeds the configured size limit, regardless of which endpoint initiated the download.

#### Scenario: Remote response is not an image

- **WHEN** any cover endpoint downloads a URL whose response `Content-Type` does not start with `image/`
- **THEN** the system returns a 400 error and the existing cover is unchanged

#### Scenario: Remote response exceeds 10MB

- **WHEN** any cover endpoint downloads a URL whose body exceeds the 10MB limit (declared `Content-Length` or actual bytes received)
- **THEN** the system returns a 400 error and the existing cover is unchanged
