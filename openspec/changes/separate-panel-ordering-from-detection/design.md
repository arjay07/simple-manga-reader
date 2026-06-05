# Design

## Decision 1 — Derive order at read time (vs. store ordered, vs. materialized re-order)

Three options for where ordering lives relative to storage:

| Option | Cost to apply an ordering change | Read cost | Storage | Notes |
|---|---|---|---|---|
| **A. Store ordered only** (original) | Full ML re-run of the volume | Cheap (read JSON) | 1× | Ordering change = re-detect everything |
| **B. Derive on read** (**chosen**) | None — next read reflects it | `assignReadingOrder` per page read | 1× | Stored geometry is the source of truth; order is a pure view |
| **C. Store raw + ordered, explicit re-order action** | None (re-order action) | Cheap (read ordered JSON) | ~2× | Raw column + endpoint + admin UI + backfill of pre-existing rows |

**Chosen: B.** For a self-hosted, single-user reader the only real cost of B — running `assignReadingOrder` on each read — is negligible: it is a pure, sub-millisecond function over ~5–15 boxes, dwarfed by the `JSON.parse` already on that path, even when the reader prefetches ~50 pages via `getPanelDataForPages`. In exchange, B deletes an entire column, a migration, a re-order endpoint, an admin control, and the backfill problem that C carries. Crucially, an ordering-algorithm change applies to the whole corpus *automatically* on next read — there is no action to remember to run, and old volumes are never left stale.

C's advantages (a materialised cache, a stored-vs-recomputed diff, an explicit observable action) do not pay for themselves here: the cache saves sub-milliseconds, and there is nothing to diff once order is *defined* as a derivation of geometry — you inspect by rendering the result in `/admin/panel-detect`, which already shows live ordering. C earns its keep only at a scale (many concurrent readers, or genuinely expensive ordering) this app does not have.

### Why B needs no raw column or backfill

C's central complication is that pre-existing rows have no raw detector output to re-order from, forcing a `raw_panels_json` column and a "needs detection" backfill path. B sidesteps this entirely: the geometry in `panels_json` (`x/y/width/height/confidence`) **is** the `RawPanel[]` that ordering consumed. Detection calls `assignReadingOrder(rawPanels)`, which maps each raw box to an ordered panel by adding `id` + `readingOrder` and never mutates geometry (`reading-order.ts`). Stripping those two derived fields back off the stored panels yields exactly the ordering input. So every row — including ones written before this change — already carries everything needed to re-order, with no new column and no migration.

### Consequence: stored order is non-authoritative

After this change, the `readingOrder` values and `reading_tree_json` written by detection are a snapshot that reads ignore and recompute. We keep writing them (the write path is untouched) because `panels_json` must store the geometry anyway and the stored order is a harmless, sensible default; nothing reads it as truth. We do not attempt to keep it in sync — it is simply re-derived in memory on each read.

## Decision 2 — Where derivation happens

Read-time derivation lives in the three retrieval functions of `src/lib/panel-data.ts` (`getPanelDataForPage`, `getPanelDataForVolume`, `getPanelDataForPages`), via one shared row→page mapper so there is a single place ordering is applied on read. Each parses `panels_json`, passes the panels (typed as `RawPanel[]`) to `assignReadingOrder`, and returns the freshly-ordered `panels` + `readingTree`. `assignReadingOrder` is consumed as-is; this change adds only the storage-aware read seam around it, not any algorithm change.

The detection write path continues to call `assignReadingOrder` itself (unchanged). We deliberately do **not** introduce a separate `orderPage`/`order.ts` producer or unify the two call sites — the write-side order is now a don't-care, so a shared "single producer" abstraction would imply a significance it no longer has.

## Decision 3 — Cost ceiling and when to revisit

The per-read cost is bounded by panels-per-page (single digits to low tens) and pages-per-read (≤50 via `getPanelDataForPages`). If a future change makes ordering materially expensive (e.g. a global cross-page optimisation) or introduces multi-reader server load, revisit C — the read seam is the natural place to add a memoised/materialised cache without touching the algorithm or the write path. Until then, derivation stays.

## Sequencing & dependency

```
modularize-panel-detect §0 (test baseline, merged)  ──┐
                                                      ▼
                              this change (read-time derivation)
```

Behaviour-preserving for the *algorithm*: the §0 snapshot must stay green throughout. The XY-cut and scored-cut ordering fixes themselves landed in separate changes against that same baseline; this change merely makes any such fix reach already-stored volumes automatically, on next read.
