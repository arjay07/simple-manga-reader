## 1. Setup & Dependencies

- [x] 1.1 Install `sharp`, `onnxruntime-node`, `mupdf`, and `canvas` npm dependencies
- [x] 1.2 Add `models/` directory to `.gitignore`
- [x] 1.3 Create model download utility that fetches the manga109_yolo small ONNX file from HuggingFace to `models/` on first use

## 2. Shared Types & Schema

- [x] 2.1 Create `src/lib/panel-detect/types.ts` with TypeScript types for panel output (Panel, ReadingTreeNode, DetectionResult, PageType, DetectionMethod, RawPanel)

## 3. Page Image Extraction

- [x] 3.1 Create `src/lib/panel-detect/extract-page.ts` with pdftoppm primary + mupdf WASM fallback for cross-platform PDF page extraction

## 4. Contour/Gutter Detection Method (implemented but superseded by ML)

- [x] 4.1 Create `src/lib/panel-detect/contour.ts` with gutter projection algorithm
- [x] 4.2 Implement horizontal/vertical projection and peak detection
- [x] 4.3 Implement recursive page splitting along detected gutters
- [x] 4.4 Implement page type classification
- [x] 4.5 Normalize panel coordinates to 0-1 range

## 5. ML (ONNX/YOLO) Detection Method

- [x] 5.1 Create `src/lib/panel-detect/ml.ts` with ONNX model loading and session caching
- [x] 5.2 Implement image preprocessing: letterbox resize to 640x640, normalize to float32 CHW tensor
- [x] 5.3 Implement YOLO output parsing: extract bounding boxes, filter to `frame` class, apply confidence threshold
- [x] 5.4 Implement standard NMS + containment-based suppression for large low-confidence boxes
- [x] 5.5 Normalize panel coordinates to 0-1 range (accounting for letterbox padding offset)
- [x] 5.6 Add coverage-gap inference for borderless/bleed panels (top, bottom, side gaps)
- [x] 5.7 Add gap merging for borderless panels spanning multiple rows
- [x] 5.8 Add bidirectional overlap checking (candidate vs existing AND existing vs candidate)
- [x] 5.9 Add debug output with all raw detections (all classes/confidences) for diagnostics
- [x] 5.10 Upgrade from nano to small model variant for better accuracy on dense layouts

## 6. Reading Order Algorithm

- [x] 6.1 Create `src/lib/panel-detect/reading-order.ts` with row-based RTL sorting
- [x] 6.2 Implement row grouping by top-edge proximity (50% of shorter panel's height)
- [x] 6.3 Implement RTL sort within rows (right edge descending)
- [x] 6.4 Implement tall-panel deferral for leftmost panels spanning multiple rows
- [x] 6.5 Build `readingTree` output structure from sorted panel order

## 7. API Endpoint

- [x] 7.1 Create `src/app/api/panel-detect/route.ts` with POST handler (ML-only, configurable confidence threshold)
- [x] 7.2 Validate request parameters (series/volume exist, page in range)
- [x] 7.3 Extract page image, run ML detection with post-processing, return JSON with base64 page image

## 8. Admin UI Page

- [x] 8.1 Create `src/app/admin/panel-detect/page.tsx` with series/volume/page selection controls
- [x] 8.2 Fetch series list and volumes from existing manga API endpoints (with basePath support)
- [x] 8.3 Implement analyze button with loading state
- [x] 8.4 Render page image with canvas overlay: color-coded bounding boxes (green=high conf, yellow=medium, red=low) with reading order numbers and confidence scores
- [x] 8.5 Display method name, processing time, panel count, and page type
- [x] 8.6 Add detected panels table with position, size, and confidence details
- [x] 8.7 Add collapsible JSON output viewer with copy-to-clipboard
- [x] 8.8 Add previous/next page navigation with auto-analyze
- [x] 8.9 Add confidence threshold slider
- [x] 8.10 Sync series/volume/page to URL query params with auto-analyze on load
