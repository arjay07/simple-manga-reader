## ADDED Requirements

### Requirement: Edit mode toggle on profile selector
The profile selector page SHALL display a "Manage Profiles" button below the profile grid. Activating this button SHALL enter edit mode. In edit mode, a "Done" button SHALL replace the "Manage Profiles" button. Activating "Done" SHALL exit edit mode.

#### Scenario: Enter edit mode
- **WHEN** user clicks "Manage Profiles"
- **THEN** the page enters edit mode: profile cards show a pencil/edit indicator, and a "Done" button appears

#### Scenario: Exit edit mode
- **WHEN** user clicks "Done" in edit mode
- **THEN** the page returns to normal selection mode with no edit indicators

### Requirement: Tapping a profile in edit mode opens edit modal
In edit mode, tapping a profile card SHALL open the edit modal for that profile instead of selecting it.

#### Scenario: Open edit modal
- **WHEN** edit mode is active AND user taps a profile card
- **THEN** a modal dialog opens pre-populated with that profile's name, avatar, and child flag

#### Scenario: Normal mode tap still selects
- **WHEN** edit mode is NOT active AND user taps a profile card
- **THEN** the profile is selected and user navigates to the library

### Requirement: Edit profile name and avatar
The edit modal SHALL allow the user to change the profile name and avatar emoji. The system SHALL persist changes via PUT `/api/profiles/[id]`.

#### Scenario: Change name and save
- **WHEN** user modifies the name field and clicks "Save Changes"
- **THEN** the profile is updated in the database AND the profile selector reflects the new name immediately

#### Scenario: Change avatar and save
- **WHEN** user selects a different emoji avatar and clicks "Save Changes"
- **THEN** the profile is updated with the new avatar AND the profile card shows the new emoji

#### Scenario: Name validation
- **WHEN** user clears the name field and tries to save
- **THEN** an error message is shown and the save is prevented

#### Scenario: Duplicate name error
- **WHEN** user changes the name to one that already exists and saves
- **THEN** an error message is displayed indicating the name is taken

### Requirement: Child profile toggle
The edit modal SHALL include a toggle switch labeled "Child profile". The toggle state SHALL be persisted as `is_child` on the profile record.

#### Scenario: Enable child flag
- **WHEN** user toggles "Child profile" on and saves
- **THEN** the profile's `is_child` field is set to 1 in the database

#### Scenario: Disable child flag
- **WHEN** user toggles "Child profile" off and saves
- **THEN** the profile's `is_child` field is set to 0 in the database

### Requirement: Delete profile with confirmation
The edit modal SHALL include a "Delete Profile" option. Activating it SHALL show an inline confirmation with a warning about reading progress loss. Confirming SHALL delete the profile and all associated reading progress.

#### Scenario: Delete with confirmation
- **WHEN** user clicks "Delete Profile" AND confirms the inline prompt
- **THEN** the profile and its reading progress are deleted AND the profile disappears from the selector

#### Scenario: Cancel delete
- **WHEN** user clicks "Delete Profile" AND cancels the inline prompt
- **THEN** no deletion occurs and the edit modal remains open

### Requirement: Database schema supports child flag
The `profiles` table SHALL have an `is_child` column (INTEGER, default 0). The PUT API endpoint SHALL accept and persist the `is_child` field.

#### Scenario: Migration adds column
- **WHEN** the application starts with an existing database lacking the `is_child` column
- **THEN** the column is added automatically via ALTER TABLE with default 0

#### Scenario: API accepts is_child
- **WHEN** a PUT request to `/api/profiles/[id]` includes `is_child: 1`
- **THEN** the profile's `is_child` field is updated to 1

### Requirement: Mobile and desktop responsiveness
The edit modal SHALL be usable on both mobile and desktop. On screens below 640px, the modal SHALL take near-full width. Touch targets (emoji buttons, toggles) SHALL be at least 44px.

#### Scenario: Mobile layout
- **WHEN** the viewport is below 640px
- **THEN** the edit modal takes near-full width with appropriate padding

#### Scenario: Desktop layout
- **WHEN** the viewport is 640px or above
- **THEN** the edit modal is centered with a max-width constraint
