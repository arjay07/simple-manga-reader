## Context

The manga reader currently renders PDF pages to canvas via pdfjs-dist on the client. There is no server-side page image extraction or analysis. The admin system uses a client-side `AdminProvider` context to gate destructive actions, but there is no dedicated `/admin` route hierarchy yet.

PDF pages are served via `GET /api/manga/[seriesId]/[volumeId]/pdf` as streaming file responses. Server-side PDF utilities exist in `src/lib/pdf-utils.ts` using `pdftoppm` for cover generation. The app uses better-sqlite3 for persistence and Tailwind CSS v4 with dark mode support.

## Goals / Non-Goals

**Goals:**
- Establish a server-side pipeline that extracts a single PDF page as an image and runs panel detection on it
- Implement ML-based panel detection with post-processing to handle borderless panels
- Provide an admin UI to visually evaluate detection quality on any page in the library
- Define a normalized JSON format suitable for later smart zoom consumption

**Non-Goals:**
- Smart zoom implementation (future work that consumes this output)
- Batch processing of entire volumes (future — this is single-page analysis only)
- Training or fine-tuning ML models
- Panel detection for non-manga content (Western comics, webtoons)
- Persisting detection results to the database (test page is ephemeral)

## Decisions

### 1. Server-side processing with sharp + onnxruntime-node

**Decision:** All image processing and ML inference happens server-side in API route handlers.

**Rationale:** Server-side avoids shipping large WASM bundles (OpenCV.js ~8MB, ONNX Runtime WASM) to the browser. sharp is the de facto Node.js image library with native performance. onnxruntime-node provides native ONNX inference without browser compatibility concerns.

**Alternatives considered:**
- Browser-side Canvas API + ONNX WASM: Simpler deployment but poor mobile performance, blocks UI thread
- Python sidecar: Maximum flexibility but adds deployment complexity and a second runtime

### 2. deepghs/manga109_yolo small model for ML detection

**Decision:** Use the small variant (YOLOv11, ~38MB ONNX, mAP50 0.938) from HuggingFace.

**Rationale:** Trained on Manga109 (real professional manga), ONNX file available for direct download (no Python export step), detects `frame` class which maps directly to panel bounding boxes. Started with the nano variant (10.5MB, mAP50 0.916) but upgraded to small during testing — nano missed panels in dense layouts with dark backgrounds.

**Alternatives considered:**
- Nano variant (10.5MB): Faster but missed too many panels on complex pages
- mosesb/best-comic-panel-detection (YOLOv12x, ~260MB): Higher accuracy but 25x larger, trained on Western comics not manga, requires manual ONNX export
- Medium/large variants (80-100MB): Could upgrade further if small proves insufficient

### 3. ML-only detection (contour method deprecated)

**Decision:** Focus exclusively on ML-based detection. A contour/gutter method was implemented initially for comparison but ML proved significantly better in testing.

**Rationale:** During side-by-side testing, the contour method consistently merged panels (missed fine gutters) and couldn't handle any irregular layouts. The ML model detected panels correctly in ~90%+ of cases. The contour code remains in the codebase but the API and UI now only use ML.

### 4. Post-processing pipeline for ML detection

The raw YOLO output goes through several post-processing steps discovered during iterative testing:

#### 4a. Containment-based NMS
**Decision:** In addition to standard IoU-based NMS, suppress large low-confidence boxes that contain smaller higher-confidence boxes.

**Rationale:** The model sometimes produces spurious large bounding boxes covering most of the page alongside correct smaller detections. Standard NMS doesn't catch these because the IoU between a large and small box is low. Containment suppression checks if >60% of a smaller higher-confidence box falls inside a larger lower-confidence box, and removes the larger one.

#### 4b. Coverage-gap inference for borderless panels
**Decision:** After ML detection, scan for large uncovered page regions and infer them as missing panels.

**Rationale:** The YOLO model is trained on panels with visible black borders. Full-bleed art, splash panels, and borderless panels produce zero detections. By checking for gaps at the top, bottom, and sides of detected panels, we infer the uncovered regions as additional panels with 0.50 confidence.

**Gap detection rules:**
- Top/bottom gaps: trigger if >10% of page height is uncovered
- Left/right gaps: trigger only if >20% of page width is uncovered (avoids false positives on narrow margins)
- Side gaps next to individual panels: trigger if >15% page width uncovered beside a panel
- Adjacent inferred gaps are merged (handles borderless panels spanning multiple rows)
- Bidirectional overlap checking: an inferred panel is rejected if >30% of ANY existing panel's area falls inside it (prevents false panels overlapping real detections)

#### 4c. Debug output
**Decision:** Include raw YOLO detection data (all classes, all confidence levels) in the API response for debugging.

**Rationale:** Essential for understanding why panels are missed — allows distinguishing between "model didn't detect it at all" vs "detected with wrong class" vs "detected but filtered out."

### 5. RTL reading order via row grouping with tall-panel deferral

**Decision:** Replaced recursive spatial partitioning with a simpler row-based sorting approach after the former proved unreliable with overlapping bounding boxes.

**Rationale:** The recursive cut algorithm failed when panels overlapped horizontally (common with imprecise ML bounding boxes). The row-based approach is more robust.

**Algorithm:**
1. Sort panels by top edge
2. Group into rows: panels whose top edges are within 50% of the shorter panel's height are in the same row
3. Sort each row RTL (right edge descending)
4. **Defer tall left-side panels:** If the leftmost panel in a row spans into subsequent rows, defer it to after the last row it overlaps with. This handles the "tall left panel + stacked right panels" pattern where right panels should be read first. Only the leftmost panel is eligible for deferral — middle and right panels stay in place.
5. Flatten rows into final reading order

### 6. PDF page to image extraction with cross-platform fallback

**Decision:** Use `pdftoppm` when available, fall back to `mupdf` (WASM) on systems without poppler.

**Rationale:** `pdftoppm` is already used for cover generation but isn't available on Windows by default. `pdfjs-dist` server-side rendering failed due to worker module resolution issues in Next.js bundling. `mupdf` provides reliable cross-platform PDF rendering via WASM with no native dependencies.

### 7. Model storage strategy

**Decision:** Store the ONNX model file in a `models/` directory at the project root. Download on first use if not present.

**Rationale:** The model is ~38MB — small enough to download once, too large to commit to git. Lazy download on first API call avoids blocking app startup. The `models/` directory is gitignored.

### 8. URL-driven state for the admin page

**Decision:** Sync series, volume, and page selection to URL query params (`?series=2&volume=24&page=7`). Auto-analyze on page load when all params are present. Prev/next navigation auto-triggers analysis.

**Rationale:** Enables sharing specific page results and rapid iteration when testing — no need to re-select series/volume on every page refresh.

## Risks / Trade-offs

- **[Risk] ONNX model accuracy on specific manga styles** → The small model has mAP50 0.938; some styles (dense dark scenes, very small panels) may have lower accuracy. Mitigation: the test page exists precisely to evaluate this. Can upgrade to medium/large variant if needed.

- **[Risk] onnxruntime-node native module compilation** → Native modules can have build issues on some platforms. Mitigation: onnxruntime-node publishes prebuilt binaries for major platforms. Windows Defender may temporarily block model loading on first use (system error 13) — resolves on retry.

- **[Risk] Coverage-gap inference heuristics** → False positives possible on pages with intentional whitespace or unusual layouts. The 0.50 confidence score distinguishes inferred panels from model-detected ones.

- **[Trade-off] No caching of detection results** → Each analysis re-processes from scratch. Acceptable for a test tool analyzing single pages.

- **[Trade-off] Reading order is heuristic-based** → The row grouping + deferral approach handles most layouts but may produce incorrect order on highly irregular or overlapping panel arrangements.
