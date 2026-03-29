## ADDED Requirements

### Requirement: Panel detection API endpoint
The system SHALL expose a `POST /api/panel-detect` endpoint that accepts a series ID, volume ID, page number, and list of detection methods, and returns detected panels for that page.

#### Scenario: Successful detection with both methods
- **WHEN** a POST request is sent with valid `seriesId`, `volumeId`, `page`, and `methods: ["contour", "ml"]`
- **THEN** the response SHALL contain a `results` object with keys for each requested method, each containing the panel detection output

#### Scenario: Single method requested
- **WHEN** a POST request is sent with `methods: ["contour"]`
- **THEN** the response SHALL contain results only for the `contour` method

#### Scenario: Invalid volume or page
- **WHEN** a POST request references a non-existent series, volume, or out-of-range page number
- **THEN** the response SHALL return a 400 or 404 error with a descriptive message

#### Scenario: ML model not available
- **WHEN** the ML method is requested but the ONNX model file is not downloaded
- **THEN** the system SHALL attempt to download the model, or return an error indicating the model is unavailable with instructions

### Requirement: Normalized panel output schema
Each detection method SHALL output panels using normalized coordinates (0-1 range relative to page dimensions) so results are resolution-independent.

#### Scenario: Panel coordinate format
- **WHEN** a panel is detected on a page of any resolution
- **THEN** each panel object SHALL contain `x`, `y`, `width`, `height` as floating-point values between 0 and 1, where (0,0) is the top-left corner

#### Scenario: Output fields per panel
- **WHEN** a panel is detected
- **THEN** the panel object SHALL include: `id` (string), `readingOrder` (integer, 1-based), `x`, `y`, `width`, `height` (normalized floats), and `confidence` (float 0-1)

### Requirement: Page type classification
Each detection result SHALL classify the page type based on detected panels.

#### Scenario: Multiple panels detected
- **WHEN** two or more panels are detected on a page
- **THEN** the `pageType` SHALL be `"panels"`

#### Scenario: No panels or single full-page panel detected
- **WHEN** zero panels are detected, or one panel covers more than 90% of the page area
- **THEN** the `pageType` SHALL be `"full-bleed"` or `"cover"`

#### Scenario: Mostly blank page
- **WHEN** the page has very little content (below a defined threshold)
- **THEN** the `pageType` SHALL be `"blank"`

### Requirement: Contour/gutter detection method
The system SHALL implement a contour-based panel detection method using gutter projection analysis.

#### Scenario: Regular grid layout
- **WHEN** a page has clearly defined white gutters between rectangular panels
- **THEN** the contour method SHALL detect each panel as a separate bounding box

#### Scenario: Full-bleed page with no gutters
- **WHEN** a page has no significant white gutters (full art page)
- **THEN** the contour method SHALL return the entire page as a single panel with `pageType` of `"full-bleed"`

#### Scenario: Processing pipeline
- **WHEN** the contour method is invoked on a page image
- **THEN** the system SHALL convert to grayscale, apply adaptive thresholding, compute row/column projections, detect gutter peaks, and recursively split the page into panel regions

### Requirement: ML-based detection method
The system SHALL implement an ML-based panel detection method using a YOLOv11 ONNX model.

#### Scenario: Model inference pipeline
- **WHEN** the ML method is invoked on a page image
- **THEN** the system SHALL resize the image to the model's expected input size, run ONNX inference, filter results to the `frame` class, apply non-maximum suppression, and return bounding boxes as panels

#### Scenario: Confidence filtering
- **WHEN** the model produces detections with varying confidence scores
- **THEN** only detections above a minimum confidence threshold (default 0.25) SHALL be included in the output

### Requirement: RTL reading order via recursive spatial partitioning
The system SHALL compute reading order for detected panels using a recursive spatial partitioning algorithm that supports right-to-left manga reading direction.

#### Scenario: Regular grid with simple rows
- **WHEN** panels form clear horizontal rows
- **THEN** rows SHALL be processed top-to-bottom, and panels within each row SHALL be ordered right-to-left

#### Scenario: Panel spanning multiple sub-rows
- **WHEN** a tall panel occupies the full height alongside smaller stacked panels
- **THEN** the algorithm SHALL find a vertical cut separating the tall panel from the sub-rows, process the right side first (RTL), recurse into sub-rows, then process the left side

#### Scenario: No clean cuts possible
- **WHEN** no horizontal or vertical cut can separate panels without bisecting one
- **THEN** the algorithm SHALL fall back to geometric sorting (top-right corner priority)

### Requirement: Reading tree output
The system SHALL output a `readingTree` structure that captures the recursive spatial partition hierarchy alongside the flat `panels` array.

#### Scenario: Tree structure for grid layout
- **WHEN** a page is partitioned by a horizontal cut followed by vertical cuts
- **THEN** the `readingTree` SHALL reflect the cut hierarchy with `cut` (direction), `at` (normalized position), and child nodes (`top`/`bottom` or `left`/`right`)

#### Scenario: Leaf node
- **WHEN** a partition region contains exactly one panel
- **THEN** the tree node SHALL be a leaf referencing the panel's `id`

### Requirement: Processing time tracking
Each detection result SHALL include the time taken for processing.

#### Scenario: Timing output
- **WHEN** a detection method completes
- **THEN** the result SHALL include `processingTimeMs` as an integer representing elapsed milliseconds

### Requirement: Page image in response
The API response SHALL include the rendered page image for client-side overlay display.

#### Scenario: Image format
- **WHEN** a detection request completes successfully
- **THEN** the response SHALL include a `pageImage` field containing the page rendered as a base64-encoded JPEG or PNG string
