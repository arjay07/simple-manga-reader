## Why

The profile selector currently only supports creating new profiles. Users cannot edit their name, avatar, or delete a profile once created. This makes profile management rigid — typos and preference changes require deleting and recreating profiles (losing reading progress). Additionally, we need a "child profile" flag to support future content filtering.

## What Changes

- Add a "Manage Profiles" toggle to the profile selector that enters an edit mode (Netflix-style)
- In edit mode, tapping a profile opens an edit modal instead of selecting it
- Edit modal allows changing name, avatar, and toggling a "child profile" flag
- Edit modal includes a "Delete Profile" option with confirmation
- Add `is_child` column to the profiles database table
- Accept `is_child` in the profile PUT API endpoint

## Capabilities

### New Capabilities
- `profile-edit`: UI and API support for editing existing profiles (name, avatar, child flag) and deleting profiles from the profile selector screen

### Modified Capabilities

## Impact

- **Database**: New `is_child` column on `profiles` table (migration in `db.ts`)
- **API**: `PUT /api/profiles/[id]` updated to accept `is_child` field
- **UI**: `src/app/page.tsx` gains edit mode state; new `ProfileEditModal` component
- **Components**: `src/components/Profile/ProfileForm.tsx` may be refactored to share form logic with the edit modal
