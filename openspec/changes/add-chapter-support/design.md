## Context

The reader currently models every reading unit as a "volume." A volume is one file (`.pdf` or `.cbz`) sitting flat inside `MANGA_DIR/<Series>/`. The `volumes` table is the source of truth, and `reading_progress`, `panel_data`, and `panel_queue_items` all reference it by `volume_id`. URLs, types, components, and storage paths all carry the word *volume*.

Some manga collections aren't shaped like that. Scanlation releases drop as numbered chapter files. Ongoing series that haven't been collected into print volumes exist only as chapters. Today, the reader can either swallow these collections by renaming chapter files to look like fake volumes (lying about the data), or skip them entirely.

The right primitive is "reading unit" — one file, sortable by number, openable by the reader. *Volume* and *chapter* are different labels on the same primitive, with the label determined by the series the unit belongs to. This change adds a per-series `kind` discriminator (`'volume' | 'chapter'`), and renames the volume-flavored data model to a kind-agnostic one so the noun in the code tells the truth.

## Goals / Non-Goals

**Goals:**

- Each series is exactly one kind, decided when the scanner first creates the series row. Kind never changes implicitly.
- The data layer is kind-agnostic: a unit is a unit; only `series.kind` controls labels and a small amount of UI behavior.
- Existing libraries (all volume-shaped) continue working after migration with zero user action.
- Existing reading progress is preserved through the rename.
- Chapter-based series get correct labels, correct number extraction, and reasonable cover-art defaults without bolting on chapter-only code paths.

**Non-Goals:**

- Mixed kinds within a single series. Each series is one shape.
- A vertical chapter-list view as an alternative to the thumbnail grid. The same grid renders both kinds for now; a list view can be a separate change if chapter series grow large.
- MangaDex chapter→volume mapping (assigning the parent volume's cover to each chapter). Explored and rejected as overkill for the visual payoff.
- Backwards-compatible redirects from `/read/[seriesId]/[volumeId]`. Single-user self-hosted app; the URL rename is a one-time bookmark inconvenience.
- Rolling back. The schema rename is a one-way migration.

## Decisions

### 1. Detect kind via asymmetric subfolder convention (not heuristic, not marker file, not pending tray)

Flat files in `MANGA_DIR/<Series>/` → `kind='volume'`. Files inside `MANGA_DIR/<Series>/chapters/` (case-insensitive, hardcoded name) → `kind='chapter'`. Volume series stay flat; there is no symmetric `volumes/` folder.

*Alternatives considered:*
- **Filename heuristic (one regex picks kind).** Filenames are ambiguous (`047.cbz` is volume 47 or chapter 47?). First-scan verdict locks in the wrong guess. Recovery requires UI plumbing.
- **Marker file (`.chapters`).** Explicit but out-of-band; easy to forget.
- **Pending-classification tray.** Most aligned with "kind decided at add time" but adds a manual step that the current "drop folder + restart" flow doesn't have, and the classification only lives in the DB (lost on reset).

*Why subfolder wins:* the filesystem is already the source of truth (folder = series). Extending that convention with one more rule keeps the model coherent. The kind is durable and visible — `ls` answers "why is this a chapter series?" without database access. Existing libraries need zero changes (flat = volume).

### 2. Schema: one table `reading_units` + `series.kind` (not parallel chapters table, not keep-volumes-as-misnomer)

Drop `volumes`, create `reading_units` with the same shape but `volume_number` → `unit_number`. Add `series.kind`. Rename `volume_id` → `unit_id` on `reading_progress`, `panel_data`, `panel_queue_items`.

*Alternatives considered:*
- **Parallel `chapters` table** with polymorphic FKs in `reading_progress` and `panel_data`. Doubles the surface area for no data-model benefit (chapters and volumes have identical columns). Every join becomes a UNION or two-branch lookup.
- **Keep `volumes` table; add `series.kind` only.** Smallest schema diff but bakes a misnomer into the codebase forever. The word *volume* becomes a lie for half the data, and future maintainers carry that confusion.

*Why rename wins:* the data is structurally identical between kinds. A single table tells the truth. The migration is painful but one-time, and after it the code never has to apologize for its names.

### 3. Single boot migration (not staged dual-write)

One transaction on the next boot: add `kind` column, build `reading_units`, copy rows from `volumes`, drop `volumes`, rename FKs. No window where both tables exist.

*Alternative:* staged migration — add `reading_units` alongside `volumes`, dual-write from the scanner, switch reads, then drop `volumes`. Safer for live production, ~3x the work.

*Why single wins:* single-user self-hosted app, predictable downtime (next boot), and the staged path's safety margin is worth less here than the simplicity of one-shot.

### 4. localStorage read-side migration shim, not rename-only

On read of `progress:{profileId}:{unitId}`, also check `progress:{profileId}:{volumeId}` (using the same numeric id, since unit IDs ARE the old volume IDs after the table rename — `INSERT INTO reading_units SELECT * FROM volumes` preserves the primary keys). If the old key exists, copy to the new key and delete the old.

*Alternative:* drop the old keys. Anyone with the app open at the moment of migration loses unsynced progress.

*Why shim wins:* ~10 lines of code, zero data loss risk, removable as a follow-up cleanup once the user is sure no old keys remain.

### 5. Collision rule: existing DB kind wins; warn in log

If a series folder has both flat files AND a `chapters/` subfolder, the scanner defers to whatever kind was set on the existing `series` row, logs a warning naming the conflicting source, and ignores files in the wrong location. For a brand-new series where both are present on first scan, flat files win (the historical convention).

*Why:* surprise-free. The user's intentional setup (whatever the DB already reflects) is preserved. The warning surfaces the mistake without breaking the library.

### 6. Filename number extraction branches by kind (not one generic regex)

The scanner knows the series kind before parsing each filename in the loop. Volume vocab: `vol|v|#|trailing-number` (existing). Chapter vocab: `chapter|ch|#|trailing-number`. The `#|trailing-number` patterns appear in both; the vocabulary-specific patterns (`vol`/`v` vs `chapter`/`ch`) are mutually exclusive.

*Why:* lower mis-extraction risk than a one-vocabulary-fits-all regex. The kind is already known by this point in the loop, so branching is free.

### 7. Reclassification is an admin-only action with explicit progress-loss confirmation

`POST /api/manga/[seriesId]/reclassify` (admin only). Confirms with the user that all `reading_units` rows for the series will be dropped and reading progress lost. Flips `series.kind`. The user is responsible for also moving files in the filesystem; the next scan repopulates units.

*Why:* the only failure mode this protects against is "I dropped my files in the wrong shape, scanner classified me as the wrong kind." Rare. Not worth automating; explicit destructive confirmation is appropriate.

### 8. Chapter-series cover behavior: series cover from MangaDex, per-unit from first page, no per-unit MangaDex loop

MangaDex's cover API is indexed by volume number, not chapter. For chapter series, "Fetch Metadata" runs the series-level metadata + cover fetch and stops there. Per-chapter tiles fall through to the existing first-page thumbnail mechanism (renamed cache key from `vol-` to `unit-`). The per-unit `cover/generate-web` endpoint returns 400 for units in a chapter series.

*Why:* the per-chapter endpoint has nothing to query; trying it would always 404. Failing loudly with a clear reason is better than silent no-ops.

### 9. No URL redirect from old to new `/read/...` route

Stale bookmarks 404. Single-user self-hosted app; the cost is "click the series, click resume" once. Permanent redirect code is not worth the one-time inconvenience.

## Risks / Trade-offs

- **Large rename diff touches ~25+ files.** → Mitigation: mostly mechanical grep-and-replace. Review focuses on the SQL migration (`ALTER TABLE ... RENAME COLUMN` calls) and the localStorage shim. Build + tests catch most regressions; manual smoke on the reader catches the rest.

- **SQLite `ALTER TABLE ... RENAME COLUMN` is supported in SQLite ≥3.25 (2018). better-sqlite3 ships modern SQLite, so this should work without a workaround.** → Mitigation: if the runtime SQLite is older than expected, fall back to the create-copy-drop pattern for the FK columns too. Add a startup version check.

- **Orphaned thumbnail cache files (`vol-<filename>.jpg`) remain on disk.** → Mitigation: auto-regenerate on next access under the `unit-` key. Optional one-time cleanup script if disk space matters.

- **Stale bookmarks 404.** → Mitigation: accepted; single-user app.

- **Migration is destructive (no rollback).** → Mitigation: documented as breaking in the proposal. Users should back up `data/manga-reader.db` before upgrading.

- **Misclassification at first scan (rare).** → Mitigation: admin "Reclassify series" button covers this.

- **Pending unsynced localStorage progress at the moment of migration.** → Mitigation: read-side shim copies legacy keys forward on first read.

- **Spec drift: several other specs (`cbz-archive-support`, `panel-detection`, `panel-generation-jobs`, `panel-data-storage`, `pdf-range-requests`, `smart-panel-zoom`) reference `volume_id`/`volume_number`/`volumeId` in their scenarios.** → Mitigation: this change does NOT touch those specs to keep the diff focused. Their referenced columns and URL examples become stale terminology after the rename but the described behaviors remain accurate. They will be refreshed as those capabilities evolve in future changes.

## Migration Plan

1. **Single boot migration** (`src/lib/db.ts`):
   1. Add `kind` column to `series` (idempotent guard via `pragma table_info`).
   2. If `volumes` table still exists:
      - `CREATE TABLE reading_units` with the same columns plus `unit_number` (was `volume_number`).
      - `INSERT INTO reading_units (id, series_id, title, filename, unit_number, page_count, format, created_at) SELECT id, series_id, title, filename, volume_number, page_count, format, created_at FROM volumes`. Primary keys preserved.
      - `DROP TABLE volumes`.
   3. `ALTER TABLE reading_progress RENAME COLUMN volume_id TO unit_id` (and same for `panel_data`, `panel_queue_items`). Idempotent guards via `pragma table_info` lookups.
   4. Rebuild indexes that referenced renamed tables/columns.

2. **First post-migration scan** picks up any `chapters/` subfolders already present in `MANGA_DIR` and stamps `kind='chapter'` on those series.

3. **localStorage shim** activates on first read of unit progress.

4. **Rollback strategy:** none. Document in proposal that the change is breaking; restore from DB backup if needed.

## Open Questions

None. All design decisions resolved in the exploration phase.
