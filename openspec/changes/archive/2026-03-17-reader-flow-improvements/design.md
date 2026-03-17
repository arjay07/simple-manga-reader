## Context

The manga reader currently treats each volume as an isolated reading session. When a user finishes the last page of a volume, there is no affordance to continue to the next one — they must back out to the series page and manually select the next volume. The library's "Continue Reading" section shows up to 6 equally-weighted cards with no visual hierarchy.

## Goals / Non-Goals

**Goals:**
- Enable uninterrupted reading flow across volumes (next/previous volume navigation)
- Make the most recent reading session instantly resumable from the library page
- Keep implementation minimal — no new API endpoints or database changes

**Non-Goals:**
- Auto-advancing to the next volume (user must explicitly choose)
- Preloading the next volume's PDF
- Changing the series detail page layout
- Adding volume-to-volume navigation mid-read (only at boundaries)

## Decisions

### 1. Pass adjacent volume info as server-side props

The reader's server component (`page.tsx`) already queries the current volume with a join on series. We'll add a query to fetch the next and previous volumes by `volume_number` ordering, and pass their IDs and titles as props to `MangaReader`.

**Why not fetch client-side?** The volume list is static data that doesn't change during a reading session. Server-side avoids an extra API call and loading state.

**Query approach:**
```sql
-- Next volume
SELECT id, title, volume_number FROM volumes
WHERE series_id = ? AND volume_number > ?
ORDER BY volume_number LIMIT 1

-- Previous volume
SELECT id, title, volume_number FROM volumes
WHERE series_id = ? AND volume_number < ?
ORDER BY volume_number DESC LIMIT 1
```

### 2. End-of-volume overlay as a slide-up card (not a modal)

When the user reaches the last page, a card slides up from the bottom of the screen. It does **not** block the page content — the final page remains visible behind it. The card offers:
- "Continue to Vol. X" button (if next volume exists)
- "Back to Series" link
- "Series Complete" message (if no next volume)

**Why not a full-screen modal?** The user might want to re-read the last page or take a screenshot. A non-blocking overlay respects this.

**Trigger:** The overlay appears when `currentPage === totalPages`. Attempting to navigate past the last page (swipe, tap, arrow key) also shows it. Dismissible by tapping the reading area or pressing Escape.

### 3. Previous volume offered only at page 1

Symmetrically, when the user is on page 1 and tries to go to a previous page, a similar overlay offers the previous volume. This is less critical than the next-volume flow but costs almost nothing to add.

### 4. Hero card layout for most recent reading session

The `ContinueReading` component will split its entries:
- **Entry 0** (most recent): Full-width hero card with series cover image, series title, volume title, large progress bar, and a prominent "Resume" button
- **Entries 1–5**: Existing horizontal scroll cards (unchanged)

If only 1 entry exists, show only the hero card with no scroll section. The data shape is unchanged — `entries[0]` from the progress API is already the most recent by `ORDER BY updated_at DESC`.

### 5. New `EndOfVolumeOverlay` component

A dedicated component rather than inline JSX in `MangaReader`. Props: `nextVolumeId`, `nextVolumeTitle`, `prevVolumeId`, `prevVolumeTitle`, `seriesId`, `direction` (end vs start), `onDismiss`. This keeps `MangaReader` from growing further.

## Risks / Trade-offs

- **Volume number gaps**: If volumes are numbered 1, 2, 5 (missing 3-4), the "next volume" will correctly skip to 5 since we query by `volume_number > current ORDER BY volume_number`. No risk here.
- **Null volume_number**: Some volumes may have `volume_number: null`. The SQL comparison `volume_number > null` returns no rows, so those volumes won't participate in next/prev navigation. This is acceptable — volumes without numbers are ambiguous to order.
- **Overlay dismissal on mobile**: The slide-up card must not interfere with swipe-to-turn. Solution: the overlay has its own click handler with `stopPropagation`, and swipe gestures on the overlay area are ignored.
