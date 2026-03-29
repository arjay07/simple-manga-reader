## 1. Setup & Dependencies

- [x] 1.1 Install `sharp` and `onnxruntime-node` npm dependencies
- [x] 1.2 Add `models/` directory to `.gitignore`
- [x] 1.3 Create model download utility (`src/lib/panel-detect/model-downloader.ts`) that fetches the manga109_yolo nano ONNX file from HuggingFace to `models/` on first use

## 2. Shared Types & Schema

- [x] 2.1 Create `src/lib/panel-detect/types.ts` with TypeScript types for panel output (Panel, ReadingTreeNode, DetectionResult, PageType, DetectionMethod)

## 3. Page Image Extraction

- [x] 3.1 Create a utility function that extracts a single page from a PDF as a PNG buffer using `pdftoppm` (extend existing `src/lib/pdf-utils.ts` or create new helper in `src/lib/panel-detect/`)

## 4. Contour/Gutter Detection Method

- [x] 4.1 Create `src/lib/panel-detect/contour.ts` with the gutter projection algorithm: sharp grayscale → adaptive threshold → raw pixel buffer
- [x] 4.2 Implement horizontal and vertical projection (sum white pixels per row/column) and peak detection for gutter finding
- [x] 4.3 Implement recursive page splitting along detected gutters to produce panel bounding boxes
- [x] 4.4 Implement page type classification based on gutter detection results (panels, full-bleed, cover, blank)
- [x] 4.5 Normalize panel coordinates to 0-1 range and add confidence scores based on gutter strength

## 5. ML (ONNX/YOLO) Detection Method

- [x] 5.1 Create `src/lib/panel-detect/ml.ts` with ONNX model loading and session caching
- [x] 5.2 Implement image preprocessing: resize to 640x640 with letterbox padding, normalize to float32 CHW tensor
- [x] 5.3 Implement YOLO output parsing: extract bounding boxes, filter to `frame` class, apply confidence threshold
- [x] 5.4 Implement non-maximum suppression (NMS) to deduplicate overlapping detections
- [x] 5.5 Normalize panel coordinates to 0-1 range (accounting for letterbox padding offset)

## 6. Reading Order Algorithm

- [x] 6.1 Create `src/lib/panel-detect/reading-order.ts` with the recursive spatial partitioning algorithm
- [x] 6.2 Implement horizontal and vertical cut finding (find Y/X values that don't bisect any panel)
- [x] 6.3 Implement RTL ordering: process right-before-left for vertical cuts, top-before-bottom for horizontal cuts
- [x] 6.4 Implement fallback geometric sort for cases where no clean cut exists
- [x] 6.5 Build `readingTree` output structure alongside flat `readingOrder` assignment

## 7. API Endpoint

- [x] 7.1 Create `src/app/api/panel-detect/route.ts` with POST handler accepting `{ seriesId, volumeId, page, methods }`
- [x] 7.2 Validate request parameters (series/volume exist, page in range)
- [x] 7.3 Extract page image, run requested detection methods in parallel, apply reading order, return unified JSON response with base64 page image

## 8. Admin UI Page

- [x] 8.1 Create `src/app/admin/panel-detect/page.tsx` with series/volume/page selection controls
- [x] 8.2 Fetch series list and volumes from existing manga API endpoints
- [x] 8.3 Implement analyze button that calls `POST /api/panel-detect` and manages loading state
- [x] 8.4 Render side-by-side page images with canvas overlay drawing colored bounding boxes and reading order numbers
- [x] 8.5 Display method name, processing time, panel count, and page type for each result
- [x] 8.6 Add JSON output viewer with copy-to-clipboard button
- [x] 8.7 Add previous/next page navigation buttons
