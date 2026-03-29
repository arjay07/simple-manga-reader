## Context

The manga reader currently renders PDF pages to canvas via pdfjs-dist on the client. There is no server-side page image extraction or analysis. The admin system uses a client-side `AdminProvider` context to gate destructive actions, but there is no dedicated `/admin` route hierarchy yet.

PDF pages are served via `GET /api/manga/[seriesId]/[volumeId]/pdf` as streaming file responses. Server-side PDF utilities exist in `src/lib/pdf-utils.ts` using `pdftoppm` for cover generation. The app uses better-sqlite3 for persistence and Tailwind CSS v4 with dark mode support.

## Goals / Non-Goals

**Goals:**
- Establish a server-side pipeline that extracts a single PDF page as an image and runs panel detection on it
- Implement two detection methods (contour-based and ML-based) that produce identical output schemas for direct comparison
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

### 2. deepghs/manga109_yolo nano model for ML detection

**Decision:** Use the nano variant (YOLOv11, 10.5MB ONNX, F1 0.88, mAP50 0.916) from HuggingFace.

**Rationale:** Trained on Manga109 (real professional manga), ONNX file available for direct download (no Python export step), small enough to bundle or download on first use, detects `frame` class which maps directly to panel bounding boxes.

**Alternatives considered:**
- mosesb/best-comic-panel-detection (YOLOv12x, ~260MB): Higher accuracy but 25x larger, trained on Western comics not manga, requires manual ONNX export
- Larger manga109_yolo variants (small/medium/large, 38-100MB): Can upgrade later if nano accuracy is insufficient

### 3. Gutter projection algorithm for contour detection

**Decision:** Use row/column white-pixel projection with recursive splitting rather than full OpenCV contour detection.

**Rationale:** Does not require OpenCV as a dependency (sharp handles image preprocessing). Projection-based gutter detection is simpler to implement and debug. Naturally degrades to "single panel" when no gutters are found, which is a safe fallback for full-bleed pages.

**Algorithm:**
1. sharp: render page → grayscale → adaptive threshold → raw pixel buffer
2. Compute horizontal projection (sum white pixels per row) and vertical projection (sum per column)
3. Find peaks above threshold (strong gutters)
4. Recursively split the page along strongest gutters
5. Each leaf region = one detected panel

### 4. Recursive spatial partitioning for reading order

**Decision:** Determine RTL reading order by recursively finding clean horizontal and vertical cuts between panels.

**Rationale:** Simple row-clustering fails when panels span multiple sub-rows. Recursive partitioning naturally handles L-shaped arrangements and panels spanning multiple rows/columns. The cut tree doubles as the `readingTree` output.

**Algorithm:**
1. Given a set of panel bounding boxes in a region:
2. Try horizontal cuts (Y values between panels that don't bisect any panel) — process top-to-bottom
3. Try vertical cuts (X values between panels that don't bisect any panel) — process right-to-left (RTL)
4. Recurse until each sub-region contains exactly one panel
5. If no clean cut exists, fall back to geometric sort (top-right first)

### 5. Model storage strategy

**Decision:** Store the ONNX model file in a `models/` directory at the project root. Download on first use if not present.

**Rationale:** The model is 10.5MB — small enough to download once, too large to commit to git. Lazy download on first API call avoids blocking app startup. The `models/` directory is gitignored.

### 6. PDF page to image extraction

**Decision:** Use pdfjs-dist on the server side (Node canvas) or shell out to `pdftoppm` (already used for covers) to extract a single page as a PNG buffer, then process with sharp.

**Rationale:** `pdftoppm` is already a proven dependency in the project for cover extraction (`src/lib/pdf-utils.ts`). It produces high-quality rasterization. sharp then handles all subsequent image transformations.

### 7. No database persistence for detection results

**Decision:** Detection results are computed on-demand and returned in the API response. Nothing is stored in SQLite.

**Rationale:** This is a test/evaluation tool. Persistence adds schema migration complexity for data that's ephemeral by nature. When smart zoom is implemented later, it may introduce a caching/persistence layer, but that's a separate decision.

## Risks / Trade-offs

- **[Risk] ONNX model accuracy on specific manga styles** → The nano model has F1 0.88; some styles (very irregular, artistic layouts) may have lower accuracy. Mitigation: the test page exists precisely to evaluate this. Can upgrade to small/medium variant if needed.

- **[Risk] onnxruntime-node native module compilation** → Native modules can have build issues on some platforms. Mitigation: onnxruntime-node publishes prebuilt binaries for major platforms (Windows, Linux, macOS). The Docker setup may need attention.

- **[Risk] pdftoppm not available on all systems** → Already a project dependency used for cover generation. If missing, the API returns a clear error.

- **[Trade-off] Two detection methods = more code to maintain** → Justified for the evaluation phase. Once a winner is chosen, the other can be removed.

- **[Trade-off] No caching of detection results** → Each analysis re-processes from scratch. Acceptable for a test tool analyzing single pages.
