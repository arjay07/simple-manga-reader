## 1. Database & Storage

- [x] 1.1 Add `panel_data` table creation to `src/lib/db.ts` schema init (with UNIQUE constraint on volume_id + page_number)
- [x] 1.2 Create `src/lib/panel-data.ts` with helper functions: `insertPanelData`, `getPanelDataForVolume`, `getPanelDataForPage`, `deletePanelDataForVolume`, `getPanelDataStatus`

## 2. Panel Data API

- [x] 2.1 Create `GET /api/panel-data/[volumeId]/route.ts` — return all panel data for a volume with status summary (totalPages, processedPages, isComplete)
- [x] 2.2 Create `GET /api/panel-data/[volumeId]/[page]/route.ts` — return single page panel data with re-extracted page image (base64 JPEG)
- [x] 2.3 Create `DELETE /api/panel-data/[volumeId]/route.ts` — delete all panel data for a volume
- [x] 2.4 Create `GET /api/panel-detect/page-image/route.ts` — standalone page image extraction endpoint (no detection)

## 3. Job Manager

- [x] 3.1 Create `src/lib/panel-detect/job-manager.ts` — singleton JobManager class with start, pause, resume, cancel methods and async processing loop
- [x] 3.2 Implement skip-already-processed logic (check panel_data table before processing each page)
- [x] 3.3 Implement pause/resume via async signal (Promise-based wait)
- [x] 3.4 Implement per-page error handling (log error, skip page, continue)
- [x] 3.5 Implement job status reporting (status, progress counts, per-page summaries, pagesPerSecond)

## 4. Job Control API

- [x] 4.1 Create `POST /api/panel-jobs/route.ts` — start a new job (validate volume, check no active job, invoke JobManager)
- [x] 4.2 Create `GET /api/panel-jobs/current/route.ts` — return current job status and progress
- [x] 4.3 Create `POST /api/panel-jobs/current/pause/route.ts` — pause the active job
- [x] 4.4 Create `POST /api/panel-jobs/current/resume/route.ts` — resume a paused job
- [x] 4.5 Create `POST /api/panel-jobs/current/cancel/route.ts` — cancel the active job

## 5. Admin Panel Jobs Page

- [x] 5.1 Create `/admin/panel-jobs/page.tsx` with series/volume selectors and confidence threshold slider (reuse pattern from panel-detect page)
- [x] 5.2 Add "Generate" button that calls POST /api/panel-jobs, with force re-generate option
- [x] 5.3 Implement progress bar UI with polling (processedPages/totalPages, current page, speed, ETA)
- [x] 5.4 Add Pause/Resume and Cancel buttons wired to job control endpoints
- [x] 5.5 Show completion summary when job finishes
- [x] 5.6 Build processed pages preview modal — page image with panel overlay, prev/next navigation, page info display
- [x] 5.7 Extract `DetectionCanvas` from panel-detect page into shared component (`src/components/DetectionCanvas.tsx`) for reuse in preview modal

## 6. Smart Panel Zoom (Reader)

- [x] 6.1 Add smart panel zoom toggle to reader settings UI, persisted in localStorage
- [x] 6.2 Fetch panel data for current volume when smart panel zoom is enabled (`GET /api/panel-data/:volumeId`)
- [x] 6.3 Implement panel-by-panel navigation logic: track current panel index, zoom to panel bounding box on tap, advance page on last panel
- [x] 6.4 Handle pages without panel data (full-bleed/cover/blank) — show full page, advance on tap

## 7. Verification

- [x] 7.1 Verify build passes (`npm run build`)
- [x] 7.2 End-to-end manual test: start job, pause/resume, cancel, preview pages, use smart zoom in reader
