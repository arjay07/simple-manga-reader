## 1. Database & API

- [x] 1.1 Add `is_child` column migration to `src/lib/db.ts` (ALTER TABLE if missing, default 0)
- [x] 1.2 Update `PUT /api/profiles/[id]` to accept and persist `is_child` field

## 2. Profile Edit Modal Component

- [x] 2.1 Extend `ProfileForm` with an optional `profile` prop for edit mode (pre-populate fields, switch to PUT semantics, show "Save Changes" button)
- [x] 2.2 Add child profile toggle switch to the form (labeled "Child profile", persists as `is_child`)
- [x] 2.3 Add inline delete confirmation UI to the form in edit mode ("Delete Profile" → warning + confirm/cancel)
- [x] 2.4 Wrap the edit form in a modal overlay component (backdrop, centered, responsive width)

## 3. Profile Selector Edit Mode

- [x] 3.1 Add edit mode state to `src/app/page.tsx` with "Manage Profiles" / "Done" toggle button
- [x] 3.2 In edit mode, show pencil overlay on profile cards and open edit modal on tap instead of selecting
- [x] 3.3 After save/delete in the modal, update local profiles state and close the modal

## 4. Polish & Responsiveness

- [x] 4.1 Ensure modal is near-full-width on mobile (<640px) and max-width constrained on desktop
- [x] 4.2 Handle error states (duplicate name, network failure) with inline error messages
- [x] 4.3 Verify touch targets are at least 44px on emoji grid and toggle
