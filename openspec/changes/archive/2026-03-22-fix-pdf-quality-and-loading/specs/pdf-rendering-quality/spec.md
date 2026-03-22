## ADDED Requirements

### Requirement: Canvas renders at device pixel density
PDF pages SHALL be rendered at the physical pixel resolution of the display by applying `window.devicePixelRatio` to the canvas dimensions. The canvas CSS size SHALL remain equal to the logical container size so layout is unaffected.

#### Scenario: Rendering on a high-DPI display
- **WHEN** a user opens the reader on a device with `devicePixelRatio > 1` (e.g., mobile phone or Retina display)
- **THEN** the canvas `.width` and `.height` SHALL equal the logical canvas size multiplied by `devicePixelRatio`, producing sharp text and line art

#### Scenario: Rendering on a standard display
- **WHEN** a user opens the reader on a device with `devicePixelRatio === 1`
- **THEN** canvas rendering SHALL be identical to the previous behavior (no regression)

#### Scenario: DPR applied in paginated mode
- **WHEN** the reader is in single-page or spread paginated mode
- **THEN** `MangaReader.renderPage` SHALL multiply the computed scale by `devicePixelRatio` and set `canvas.style.width/height` to the CSS dimensions

#### Scenario: DPR applied in vertical scroll mode
- **WHEN** the reader is in vertical scroll mode
- **THEN** `VerticalScrollView.renderPage` SHALL multiply the computed scale by `devicePixelRatio` and set `canvas.style.width/height` to the CSS dimensions

#### Scenario: Placeholder dimensions unaffected by DPR
- **WHEN** placeholder canvas dimensions are computed before a page is rendered in vertical scroll mode
- **THEN** placeholder `style.width/height` SHALL use CSS pixels (not physical pixels) so scroll position is correct
