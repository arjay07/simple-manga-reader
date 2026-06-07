## Context

The data model is volume-centric: a `volumes` table (`volume_number INTEGER`), `volume_id` FKs on `reading_progress` / `panel_data` / `panel_queue_items`, a `Volume` type, `/read/[seriesId]/[volumeId]` routes, a `vol-` cover prefix, and a `progress:{profileId}:{volumeId}` localStorage key. The scanner walks flat files in `MANGA_DIR/<Series>/` and writes one `volumes` row per file.

Chapter-based collections don't fit: they have no volumes, their numbers are frequently fractional (`Ch. 10.5`), and the per-volume MangaDex cover fetch is meaningless for them. A prior plan proposed a full `volumes`→`reading_units` rename (≈451 occurrences, 43 files, a four-table migration, URL/key/cover-prefix churn, and a localStorage shim). The owner's constraint is narrower and firmer: **existing volume series must render pixel-identical, and chapter support must be purely additive.** That makes the full rename unnecessary risk — "volume" simply becomes the internal name for a reading unit, and chapters are a new branch off a default.

## Goals / Non-Goals

**Goals:**
- A per-series `kind` (`'volume' | 'chapter'`) detected from the filesystem at series-row creation and immutable thereafter.
- Chapter series modeled as chapters: correct decimal numbers, numeric sort, "Ch. N" labels, sensible cover behavior.
- **Zero observable change** to existing volume series — same labels, layout, covers, URLs, keys, file paths.
- File→pages mechanics (`openPageSource`, the `/pdf` stream, panel detection, thumbnails) **identical** between kinds.

**Non-Goals:**
- Renaming `volumes`/`volume_id`/`volume_number`/`Volume` to a kind-agnostic "reading unit" (kept as internal jargon).
- URL/route renames, localStorage key changes, or a read-side key shim.
- An admin reclassify flow (kind is set once at scan; mis-detection is fixed on disk + rescan).
- Moving files on disk or re-detecting panels when kind is established.

## Decisions

### 1. Detect kind from a `chapters/` subdirectory; store it sticky on `series`
At first scan of a series folder, if a `chapters/` subdirectory contains supported files → `kind='chapter'` and the scanner enumerates `chapters/`; otherwise `kind='volume'` and it enumerates flat files (today's behavior). `series.kind` defaults to `'volume'`, so every pre-existing row and the entire volume code path are unaffected. Kind is written only on the `INSERT OR IGNORE` that creates the series row and is **never recomputed** on rescan.
- *Mixed folder (both flat files and `chapters/`):* `chapters/` wins → chapter series; flat files are ignored and a warning is logged.
- *Alternatives considered:* a per-file heuristic (filename says "chapter") — rejected as ambiguous and not sticky; an explicit marker file — rejected as extra user ceremony versus a conventional subdirectory.

### 2. Store the chapter file's `chapters/`-prefixed path in the existing `filename` column
A chapter row's `filename` is stored as e.g. `chapters/Ch 10.5.cbz` (relative to the series folder). This is the linchpin that makes "mechanics identical" literally true:
- `path.join(MANGA_DIR, folder_name, filename)` → `…/Series/chapters/Ch 10.5.cbz` — every existing resolution site (the `/pdf` route, cover/thumbnail generation, `openPageSource`) works unchanged.
- The thumbnail/override cache keys sanitize with `filename.replace(/[^a-zA-Z0-9_-]/g, '_')`, turning the slash into `_` → `vol-chapters_Ch_10_5_cbz.jpg`, a flat file in the series-root `.covers/` dir with no collision.
- *Result:* **only `scanner.ts` changes.** No path-building code anywhere downstream is touched.
- *Alternatives considered:* a separate `subdir` column (threads a new field through every path site — more churn, the thing we're avoiding); a symlink/flattening scheme (filesystem side effects).

### 3. Widen `volume_number` `INTEGER` → `REAL`
Chapter numbers need `10.5`. Widening the existing column keeps a single number field for both kinds and a single `ORDER BY volume_number` that sorts `10 < 10.5 < 11`. Existing whole values are unchanged (`3 == 3.0`), so volume rendering and sort are untouched. SQLite stores numeric affinity per-value, so this is a no-op rewrite for existing data.
- *Alternatives considered:* an INTEGER bucket + display label string (two fields to keep consistent, awkward sort); a separate `chapter_number REAL` column (a parallel nullable field and kind-branching at every read — more complexity than widening one column).

### 4. Decimal-aware chapter number extraction
Add `extractChapterNumber(filename)` matching `/ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i`, then bare-decimal and `#` fallbacks, finally the scan index. `extractVolumeNumber` is unchanged and still used for volume series. The scanner selects the extractor by the kind it just detected.

### 5. Kind-aware labels via one shared helper, volume output unchanged
A single helper (e.g. `unitLabel(kind, number)` → `"Vol. 3"` / `"Ch. 10.5"`, plus a short form and an "End of …" word) is consumed by the components that currently hardcode "Vol."/"Volume". The **volume branch reproduces today's exact strings**, so for every existing series the rendered output is byte-identical; "Ch." only appears for `kind='chapter'` rows. This is the one place where "no visual change" is a code-review checkpoint rather than an automatic guarantee.

### 6. Chapter series skip the per-volume MangaDex cover loop
The bulk cover fetch (triggered after a metadata save, `SeriesClientContent.tsx` → `runBulkCoverFetch` → `fetchVolumeCoverUrl(mangadexId, volume_number)` per unit) is gated on `kind === 'volume'`. Chapter series fetch only the whole-series cover; each chapter falls back to its page-1 thumbnail (the existing default). MangaDex has no per-chapter "volume" cover, so the loop would only produce misses.

## Risks / Trade-offs

- **"volume" now means "reading unit" internally** → Accepted: the names stay consistent with the DB and the full rename is deferred (and remains possible later). The proposal records this explicitly so future readers aren't misled.
- **Hardcoded "Vol."/"Volume" strings are scattered across ~7 components** → Mitigation: route all of them through the shared helper in one pass; add a test asserting the helper's volume branch returns the legacy strings, so a regression to the existing experience fails CI.
- **`REAL` widening must land in both `SCHEMA_SQL` and the boot migration** → Mitigation: the test harness builds from `SCHEMA_SQL`; add/extend a test that asserts the `volume_number` column affinity and that a `10.5` round-trips, catching drift between the two definitions.
- **A volume series that later grows a `chapters/` dir stays `kind='volume'`** (kind is sticky) → Accepted and documented: fix by removing the series row (or moving files) and rescanning. Reclassify is intentionally out of scope.
- **Sanitized chapter/volume cache keys could theoretically collide** (`chapters/Ch01.cbz` vs a flat `chapters_Ch01.cbz`) → Negligible: kinds never coexist in one series, and no real volume file is named `chapters_…`.

## Migration Plan

1. Ship the additive schema in `db.ts`: `ALTER TABLE series ADD COLUMN kind TEXT NOT NULL DEFAULT 'volume'` (guarded by a `table_info` check, like existing migrations) and the `volume_number` widening; mirror both in `SCHEMA_SQL`.
2. On next server boot, `scanMangaDirectory()` runs as usual; existing series keep `kind='volume'`. New series with a `chapters/` folder are created as chapter series.
3. **Rollback:** the feature is additive — reverting the code leaves the extra `kind` column harmless (ignored) and `REAL` values that happen to be whole read back identically as integers. No data migration to undo.

## Open Questions

- None blocking. (Number-storage, cover behavior, and reclassify scope were resolved during exploration: `REAL`, series-cover-plus-page-1-thumbs, and drop-reclassify respectively.)
