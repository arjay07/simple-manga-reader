# automated-test-coverage Specification

## Purpose
TBD - created by archiving change raise-test-coverage. Update Purpose after archive.
## Requirements
### Requirement: Page-type classification is regression-tested

The page-type classification logic (`classifyPageType`) SHALL have automated tests covering each branch and the full-bleed area-threshold boundary, so the `page_type` written to `panel_data` cannot silently change.

#### Scenario: No panels classifies as blank
- **WHEN** `classifyPageType` is called with an empty panel array
- **THEN** it returns `'blank'`

#### Scenario: Single large panel classifies as full-bleed
- **WHEN** `classifyPageType` is called with one panel whose area is at or above the full-bleed threshold
- **THEN** it returns `'full-bleed'`

#### Scenario: Single small panel classifies as cover
- **WHEN** `classifyPageType` is called with one panel whose area is just below the full-bleed threshold
- **THEN** it returns `'cover'`

#### Scenario: Multiple panels classify as panels
- **WHEN** `classifyPageType` is called with two or more panels
- **THEN** it returns `'panels'`

### Requirement: MangaDex metadata search is regression-tested

The MangaDex metadata search SHALL have automated tests that drive `searchManga` with a mocked `fetch`, protecting both the response-mapping behaviour (English-or-first selection, author/artist de-duplication) and the relevance-ordering request param that has previously regressed.

#### Scenario: English title preferred, falls back to first available
- **WHEN** a localized title record contains an `en` key
- **THEN** the `en` value is selected; **and WHEN** no `en` key is present, the first available value is selected

#### Scenario: Author and artist names de-duplicated
- **WHEN** a manga's relationships list the same person as both author and artist
- **THEN** that name appears only once in the joined author string

#### Scenario: Missing relationship names ignored
- **WHEN** an author/artist relationship has no `attributes.name`
- **THEN** it is omitted from the author string without error

#### Scenario: Search requests relevance ordering
- **WHEN** `searchManga` issues its request
- **THEN** the outgoing URL includes `order[relevance]=desc`

### Requirement: Reader-settings parsing is regression-tested

`parseReaderSettings` SHALL have automated tests for malformed input and the backward-compatible reading-direction fallback, so corrupt persisted settings never throw.

#### Scenario: Malformed JSON falls back to defaults
- **WHEN** `parseReaderSettings` receives `null`, an empty string, or invalid JSON
- **THEN** it returns the reader defaults without throwing

#### Scenario: Reading-direction column fallback applied
- **WHEN** the parsed settings omit `readingDirection` and a fallback direction is supplied
- **THEN** the fallback direction is used; **and WHEN** the parsed settings include `readingDirection`, the parsed value takes precedence over the fallback

### Requirement: API request-body parsing degrades safely

`parseJsonBody` SHALL have an automated test confirming malformed request bodies resolve to `null` rather than throwing, so routes return a controlled error instead of an unhandled 500.

#### Scenario: Malformed body returns null
- **WHEN** `parseJsonBody` is called on a request whose body is not valid JSON
- **THEN** it resolves to `null`

### Requirement: Panel-data validation guards are regression-tested

The input-validation guards of `insertPanelData` SHALL have automated tests covering the rejection branches, independent of the underlying SQL.

#### Scenario: Invalid volume id rejected
- **WHEN** `insertPanelData` is called with a non-positive or non-integer `volumeId`
- **THEN** it throws

#### Scenario: Invalid page number rejected
- **WHEN** `insertPanelData` is called with a non-positive or non-integer `pageNumber`
- **THEN** it throws

#### Scenario: Non-array panels rejected
- **WHEN** `insertPanelData` is called with a `panels` argument that is not an array
- **THEN** it throws

### Requirement: Panel-zoom geometry is an extracted, tested pure module

The panel-zoom geometry currently embedded in `MangaReader.tsx` SHALL be extracted into a pure module (`src/lib/reader/panel-zoom.ts`) that takes panel and viewport dimensions and returns the zoom decision, and SHALL have fixture-style tests. The extraction MUST preserve existing reader behaviour.

#### Scenario: Tall panel yields a single zoom stop
- **WHEN** the geometry function receives a panel tall enough to be readable at fit-zoom
- **THEN** it returns a single-stop result

#### Scenario: Wide short panel yields multiple stops within the cap
- **WHEN** the geometry function receives a wide, short panel
- **THEN** it returns a multi-stop result whose stop count and zoom level respect the documented caps

#### Scenario: Behaviour preserved after extraction
- **WHEN** the reader uses the extracted module
- **THEN** the smart-panel-zoom behaviour is unchanged from before extraction

### Requirement: Volume-ordering comparator is an extracted, tested helper

The volume-ordering comparator used when building a panel-detection queue (sort by `volume_number`, nulls last) SHALL be extracted into a pure, exported helper and tested directly.

#### Scenario: Volumes ordered by number with nulls last
- **WHEN** the comparator sorts volumes with a mix of numeric and null `volume_number` values
- **THEN** numbered volumes appear in ascending order and null-numbered volumes appear after them

### Requirement: Contour detection helpers are testable over synthetic pixels

The contour-detection projection and gutter helpers (`findGutters`, `horizontalProjection`, `verticalProjection`, `findPanels`) SHALL be exported and have automated tests that run over synthetic pixel buffers, without invoking `sharp`.

#### Scenario: Gutter detected in a split projection
- **WHEN** `findGutters` receives a projection with a contiguous run of high-white values wide enough and away from the edges
- **THEN** it returns a gutter centred on that run

#### Scenario: Edge runs are not treated as gutters
- **WHEN** a high-white run sits within the edge margin of the projection
- **THEN** `findGutters` excludes it

#### Scenario: A two-panel buffer splits into two regions
- **WHEN** `findPanels` runs over a synthetic buffer containing two content blocks separated by a white gutter
- **THEN** it returns two regions

### Requirement: Panel-detection queue crash-recovery and lifecycle are tested

The panel-detection queue processor's lifecycle and crash-recovery transitions SHALL be tested against an in-memory database with the job manager and ONNX session mocked, so the documented restart and cancellation invariants are protected.

#### Scenario: Restart forces paused and resets running items
- **WHEN** `restoreFromDb` runs against a queue left in a `running` state
- **THEN** the queue is set to `paused` and items left `running` are reset to `pending`

#### Scenario: Cancel skips remaining work
- **WHEN** an active queue is cancelled
- **THEN** the running/paused item becomes `cancelled` and remaining `pending` items become `skipped`

#### Scenario: Lifecycle guards reject wrong-state transitions
- **WHEN** `pause`, `resume`, or `cancel` is called with no queue in the required state
- **THEN** the call throws rather than corrupting queue state

#### Scenario: A second concurrent queue is rejected
- **WHEN** `create` is called while a queue is already active
- **THEN** it throws

### Requirement: GDrive download manifest resilience is tested

The GDrive download manager's manifest load path SHALL have automated tests confirming that a missing or corrupt manifest resolves to a sane default rather than throwing, protecting download resume.

#### Scenario: Missing manifest yields a default
- **WHEN** the manifest file does not exist
- **THEN** loading it returns an empty/default manifest without throwing

#### Scenario: Corrupt manifest yields a default
- **WHEN** the manifest file contains invalid JSON
- **THEN** loading it returns a default manifest without throwing

### Requirement: Third-party-guarantee modules are excluded from unit testing

The change SHALL document an explicit non-goal list of modules that are intentionally NOT unit-tested because doing so would only re-exercise third-party guarantees, keeping coverage effort focused on first-party logic.

#### Scenario: Excluded modules are recorded
- **WHEN** a contributor evaluates whether to add unit tests for thin DB-query wrappers, the DB schema/singleton, constant/config/type modules, React context providers, or the ONNX/`sharp` inference internals
- **THEN** the documented non-goal list identifies these as intentionally excluded and states the rationale
