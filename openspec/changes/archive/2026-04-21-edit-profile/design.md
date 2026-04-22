## Context

The profile selector (`src/app/page.tsx`) displays profile cards and an "Add Profile" button. A `ProfileForm` component handles creation only. The API already supports `PUT /api/profiles/[id]` for updates and `DELETE /api/profiles/[id]` for deletion. The database `profiles` table lacks an `is_child` column.

## Goals / Non-Goals

**Goals:**
- Allow users to edit profile name, avatar, and child flag from the profile selector
- Allow users to delete profiles with confirmation
- Netflix-style manage/edit mode toggle for clean UX
- Mobile and desktop friendly (touch targets, responsive modal)
- Add `is_child` column for future content filtering

**Non-Goals:**
- Implementing content filtering based on the child flag (future work)
- Profile reordering
- Profile photo upload (emoji-only avatars)
- Editing reading_direction or theme from this modal (those are in-app settings)

## Decisions

### 1. Edit mode toggle on the profile selector page

Add a "Manage Profiles" button below the profile grid. Clicking it enters edit mode where:
- Profile cards show a pencil overlay
- Tapping a profile opens the edit modal instead of selecting it
- "Add Profile" card remains visible (users may want to add while managing)
- A "Done" button replaces "Manage Profiles" to exit edit mode

**Rationale**: Netflix pattern is familiar to users, avoids cluttering the default selection view, and works well on both mobile (tap) and desktop (click).

### 2. Modal dialog for edit form

A centered overlay modal with backdrop. On mobile (<640px), the modal takes near-full width with padding. Contains: name input, emoji grid, child toggle, save/cancel buttons, and delete option.

**Rationale**: Modals focus attention, reuse existing form patterns, and work well across screen sizes. Inline editing would require more complex state management in the grid.

**Alternative considered**: Slide-in panel — rejected as too desktop-centric.

### 3. Shared form logic between create and edit

Rather than duplicating the emoji grid and name input, extract shared UI into the existing `ProfileForm` component by adding an optional `profile` prop for edit mode. When provided, the form pre-populates fields and switches to "Save Changes" / PUT semantics.

**Rationale**: DRY principle. The create and edit forms share 90% of their UI.

### 4. Database migration for `is_child`

Add `is_child INTEGER DEFAULT 0` to the `profiles` table via the existing migration pattern in `db.ts` (check column existence, ALTER TABLE if missing).

**Rationale**: Consistent with existing migrations (`reader_settings`, `mangadex_id`). SQLite ALTER TABLE ADD COLUMN is safe and non-locking.

### 5. Delete confirmation via inline dialog within the modal

Instead of a browser `confirm()` or a second modal, show an inline confirmation section within the edit modal when "Delete Profile" is clicked: "Are you sure? This will delete all reading progress." with Confirm/Cancel buttons.

**Rationale**: Native confirms look out of place. Nested modals are confusing. Inline confirmation is clean and mobile-friendly.

## Risks / Trade-offs

- [Name uniqueness conflict] → The DB has a UNIQUE constraint on `name`. The API will return an error if the user renames to an existing name. The modal should display this error gracefully.
- [Accidental delete] → Mitigated by inline confirmation with explicit warning about reading progress loss.
- [State sync after edit] → After saving, update the local `profiles` state array so the UI reflects changes immediately without a refetch.
