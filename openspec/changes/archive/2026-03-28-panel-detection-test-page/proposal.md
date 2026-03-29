## Why

Smart zoom (panel-by-panel navigation) requires knowing where panels are on each manga page and the correct RTL reading order. Manga panels range from regular grids to irregular/overlapping layouts with art bleeding across borders, making simple pixel-based detection insufficient. Before building smart zoom, we need a reliable panel detection pipeline and a way to evaluate its accuracy across different page types. An admin test page provides the feedback loop to iterate on detection quality.

## What Changes

- Add an admin page at `/admin/panel-detect` for visually testing panel detection on any page from the manga library
- Add a server-side API endpoint `POST /api/panel-detect` that accepts a series/volume/page and returns detected panels as JSON
- Implement two parallel detection methods for comparison:
  - **Contour/gutter projection** — classical image processing using `sharp` (adaptive threshold, row/column projection, recursive gutter splitting)
  - **ML-based detection** — YOLOv11 model (`deepghs/manga109_yolo` nano, ~10.5MB ONNX) via `onnxruntime-node`, trained on Manga109 dataset
- Both methods output the same normalized JSON schema: bounding boxes (0-1 coordinates), confidence scores, page type classification, and RTL reading order
- Reading order computed via recursive spatial partitioning algorithm that handles panels spanning multiple sub-rows/columns
- JSON output includes both a flat `panels` array with `readingOrder` and a `readingTree` capturing the partition hierarchy
- UI displays side-by-side visual overlays (bounding boxes + reading order numbers) and raw JSON output

## Capabilities

### New Capabilities
- `panel-detection`: Server-side panel detection pipeline with contour and ML methods, normalized JSON output, and reading order computation
- `panel-detection-ui`: Admin test page for selecting a volume/page, running detection, and viewing side-by-side visual results with JSON output

### Modified Capabilities

_None — this is a new standalone feature with no changes to existing capabilities._

## Impact

- **New dependencies**: `sharp` (image processing), `onnxruntime-node` (ONNX inference)
- **Model file**: `deepghs/manga109_yolo` nano ONNX (~10.5MB), needs download/storage strategy
- **New API route**: `POST /api/panel-detect` — server-side only, no client-facing API changes
- **New admin route**: `/admin/panel-detect` — gated behind admin context
- **Existing code**: No modifications to existing routes, components, or database schema
- **PDF rendering**: Reuses existing `pdfjs-dist` for page extraction, adds `sharp` for server-side image processing
