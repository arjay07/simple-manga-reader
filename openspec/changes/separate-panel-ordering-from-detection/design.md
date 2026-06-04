# Design

## Decision 1 — Store raw panels, derive order (vs. recompute order on every read)

Three options for where ordering lives relative to storage:

| Option | Detection cost to re-order | Read cost | Storage | Notes |
|---|---|---|---|---|
| **A. Store ordered only** (today) | Full ML re-run | Cheap (read JSON) | 1× | Ordering bug = re-detect everything |
| **B. Store raw only, order on read** | None | `assignReadingOrder` per read | 1× | Read path now runs the algorithm; every reader page-load pays it; harder to inspect "what was stored" |
| **C. Store raw + ordered, re-order on demand** | None (re-order action) | Cheap (read ordered JSON) | ~2× | Raw is the source of truth; ordered is a materialised view refreshed by an explicit action |

**Chosen: C.** Storage is JSON text on a handful of panels per page — doubling it is negligible. Keeping the ordered output materialised means the reader's hot path (`getPanelDataForPages`, smart-panel-zoom) is unchanged and stays cheap. Re-ordering becomes an explicit, observable action rather than a silent per-read cost, which also makes it inspectable in the admin UI ("here's what changed when I re-ordered"). Option B's "order on read" is tempting for purity but pushes algorithm cost into every reader and removes the ability to diff stored-vs-recomputed.

### Consequence: ordered output can drift from raw

With C, `panels_json` is a cache of `orderPage(raw_panels_json)`. After an algorithm change, stored ordered panels are stale until re-ordered. This is acceptable and intended — re-order is a deliberate action — but the admin UI SHOULD surface staleness is *possible* (it cannot cheaply detect it without recomputing). We do not add automatic invalidation; that is explicitly out of scope.

## Decision 2 — Backfill for pre-existing rows

Rows written before this change have `raw_panels_json = NULL` (the column is added additive-nullable). Options:

- **Reconstruct raw from ordered** — strip `readingOrder`/`id` back to `RawPanel`. Tempting, but the inferred-panel and blank-filtering logic in `detectPanelsMl` means the ordered panels are *post-inference*; treating them as raw would feed inferred panels back as if detected. Rejected — it would silently corrupt the separation.
- **Mark as "needs detection"** — the re-order action skips `NULL` raw rows and reports them. A one-time re-detect of the volume populates raw panels going forward. **Chosen** — simple, honest, no corruption. Existing ordered data keeps serving reads untouched.

## Decision 3 — Where `orderPage` lives and what it owns

A new `src/lib/panel-detect/order.ts` exposing `orderPage(rawPanels: RawPanel[], config?: PanelDetectConfig)` that wraps `assignReadingOrder` and is the single producer of `panels_json` + `reading_tree_json`. Both the detection path and the re-order path go through it, so there is exactly one place ordering happens. `assignReadingOrder` itself stays the pure core (and stays directly unit-tested by the §0 suite); `orderPage` is the thin storage-aware seam.

`reading-order.ts` is consumed as-is and not modified by this change; `orderPage` is the storage-aware seam around it. (The reading-order internals were already reworked into the recursive XY-cut in a separate change.)

## Sequencing & dependency

```
modularize-panel-detect §0 (test baseline, merged)  ──┐
                                                      ▼
  this change §1 (raw storage)  →  §2 (re-order action)  →  §3 (apply landed XY-cut fix to corpus)
                                                              │
                          §3 changes no code — it runs the §2 re-order
                          action over existing volumes and eyeballs the
                          result in the admin UI (no re-detect)
```

All three steps are behaviour-preserving for the *algorithm*: the §0 snapshot must stay green throughout. The XY-cut ordering fix itself landed in a separate change against that same baseline; here §3 merely propagates it to already-stored volumes.
