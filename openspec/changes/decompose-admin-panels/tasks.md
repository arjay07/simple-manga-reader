# Tasks

> Three independent splits. Order doesn't matter; ship them in any sequence.

## 1. GDrive download modal split

- [ ] 1.1 Create `src/components/GDrive/StatusIcon.tsx` — leaf component (move from `GDriveDownloadModal.tsx`)
- [ ] 1.2 Create `src/components/GDrive/FileRow.tsx` — uses `StatusIcon` and the `formatBytes` helper (move helper too if not already shared)
- [ ] 1.3 Create `src/components/GDrive/GDriveDownloadForm.tsx` — extract `<FormView>` (lines 171–230 of the modal). Owns URL + series-name fields, validation, submit handler
- [ ] 1.4 Create `src/components/GDrive/GDriveDownloadProgress.tsx` — extract `<ProgressView>` (lines 234–315). Consumes the `useGDriveProgress` hook output via props
- [ ] 1.5 Update `GDriveDownloadModal.tsx` to compose: backdrop + chrome + view switch on `state.status`. Should drop to ~120 lines
- [ ] 1.6 Smoke test: open modal, enter Drive URL + series name, observe progress, pause/resume, cancel, complete

**Checkpoint D1**: modal split. PR.

## 2. panel-jobs page split

- [ ] 2.1 Create `src/components/PanelJobs/QueueControls.tsx` taking `{ series, volumes, checkedVolumes, confidence, force, onChange... }`. Move JSX from `panel-jobs/page.tsx:295–398`
- [ ] 2.2 Create `src/components/PanelJobs/QueueProgressHeader.tsx` taking `{ status, onPause, onResume, onCancel }`. Move from `410–443`
- [ ] 2.3 Create `src/components/PanelJobs/QueueProgressBars.tsx` taking `{ queue, eta, elapsed }`. Move from `445–486`
- [ ] 2.4 Create `src/components/PanelJobs/QueueItemsList.tsx` taking `{ items }`. Move from `489–513`
- [ ] 2.5 Create `src/components/PanelJobs/PanelPreviewModal.tsx` — lift the self-contained modal at `541–618`
- [ ] 2.6 Update `panel-jobs/page.tsx` to compose the new components; keep the polling effect and state ownership at the page level. Target ~280 lines
- [ ] 2.7 Smoke test: pick a series + volumes, start queue, verify progress updates every ~2s, pause + resume, cancel, open preview modal, navigate pages in preview

**Checkpoint D2**: panel-jobs split. PR.

## 3. panel-detect page split

- [ ] 3.1 Create `src/components/PanelDetect/PanelControls.tsx` — series/volume/page selectors + analyze button + confidence slider. Move from `panel-detect/page.tsx:181–269`
- [ ] 3.2 Create `src/components/PanelDetect/PanelDetailsTable.tsx` — table of detected panels. Move from `301–336`
- [ ] 3.3 Create `src/components/PanelDetect/JSONViewer.tsx` — collapsible JSON + copy-to-clipboard. Move from `338–360`
- [ ] 3.4 Update `panel-detect/page.tsx` to compose; keep URL-sync and result-state at page level. Target ~200 lines
- [ ] 3.5 Smoke test: pick volume + page, run analyze, verify canvas + table + JSON all populate; copy JSON works; URL params persist on reload

**Checkpoint D3**: panel-detect split. PR.

## 4. Verification

- [ ] 4.1 `npm run lint` and `npm run build` clean
- [ ] 4.2 Each page rendered manually; UI identical to before (screenshot diff if useful)

## 5. Cleanup

- [ ] 5.1 Confirm no logic duplicated between original page and new components (extraction not copy-paste)
- [ ] 5.2 If any of the new components turn out to be reused across the three pages (unlikely), promote to a shared `src/components/Admin/` folder
