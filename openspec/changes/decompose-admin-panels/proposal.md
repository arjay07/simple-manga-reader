## Why

Two surfaces have grown into long single files even though they are visually composed of clearly distinct sections:

- **`src/app/admin/panel-jobs/page.tsx` (628 lines)** — series/volume picker, queue progress header, overall + current-page progress bars, per-item list, and a panel-preview modal all in one file. It also runs its own 2-second polling loop coupled to component state.
- **`src/components/GDrive/GDriveDownloadModal.tsx` (383 lines)** — a form view, a progress view, a per-file row, and modal chrome all in one file.
- **`src/app/admin/panel-detect/page.tsx` (366 lines)** — controls, result canvas, panel-details table, JSON viewer.

None of these is logically complex; the smell is purely component size. The audit confirmed that the seams are clean (each section has its own state bucket), and that there is **no shared abstraction worth extracting** between panel-jobs (timer-based polling) and GDrive (SSE-based streaming) — their state shapes and update mechanisms differ enough that unifying them would cost more than it saves.

## What Changes

Three independent extraction PRs. Each is a pure layout split — no behavioural change.

- **`GDriveDownloadModal` split** (1h budget):
  - `src/components/GDrive/GDriveDownloadForm.tsx` — owns the URL + series-name form (currently `GDriveDownloadModal.tsx:171–230`)
  - `src/components/GDrive/GDriveDownloadProgress.tsx` — owns the progress view (currently `234–315`)
  - `src/components/GDrive/FileRow.tsx` and `src/components/GDrive/StatusIcon.tsx` — leaf components used by the progress view
  - `GDriveDownloadModal.tsx` shrinks to ~120 lines: backdrop, escape-key handling, view switching

- **`panel-jobs/page.tsx` split** (1.5h budget):
  - `src/components/PanelJobs/QueueControls.tsx` — series/volume selector + confidence slider + force toggle (currently `panel-jobs/page.tsx:295–398`)
  - `src/components/PanelJobs/QueueProgressHeader.tsx` — status badge + pause/resume/cancel buttons (`410–443`)
  - `src/components/PanelJobs/QueueProgressBars.tsx` — overall + current-item progress bars + ETA/elapsed stats (`445–486`)
  - `src/components/PanelJobs/QueueItemsList.tsx` — per-item dots + progress display (`489–513`)
  - `src/components/PanelJobs/PanelPreviewModal.tsx` — lift the existing self-contained modal at `541–618`
  - `panel-jobs/page.tsx` shrinks to ~280 lines: state, polling effect, layout composition

- **`panel-detect/page.tsx` split** (45min budget):
  - `src/components/PanelDetect/PanelControls.tsx` — selectors + slider (`181–269`)
  - `src/components/PanelDetect/PanelDetailsTable.tsx` — table view (`301–336`)
  - `src/components/PanelDetect/JSONViewer.tsx` — collapsible JSON + copy (`338–360`)
  - `panel-detect/page.tsx` shrinks to ~200 lines

Out of scope (and explicitly rejected by the audit):

- A shared "long-running job progress" hook between panel-jobs and GDrive. Their data shapes diverge enough that abstraction would cost more than it saves.
- A `useQueuePolling` hook for panel-jobs. Reasonable to do later, but a single-consumer hook adds indirection without payoff today.

## Capabilities

### Modified Capabilities

None — pure structural refactor. All three pages render the same UI and call the same APIs.

### New Capabilities

None.

## Impact

- **Code**
  - New components under `src/components/GDrive/`, `src/components/PanelJobs/`, `src/components/PanelDetect/`.
  - The three large files shrink to thin orchestrators.
- **APIs / contracts**: none.
- **Risk**: very low. Each split is mechanical extraction with the same props that were already being passed implicitly. A 5-minute manual smoke per page is sufficient verification.
