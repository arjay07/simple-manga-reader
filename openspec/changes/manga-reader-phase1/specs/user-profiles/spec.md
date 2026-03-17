## ADDED Requirements

### Requirement: Profile selector
The system SHALL present a Netflix-style profile picker as the entry point to the application.

#### Scenario: Viewing profile selector
- **WHEN** user opens the application root URL
- **THEN** the system SHALL display all existing profiles as selectable cards with name and avatar

#### Scenario: Selecting a profile
- **WHEN** user clicks/taps on a profile card
- **THEN** the system SHALL set that profile as the active profile and redirect to the library view

#### Scenario: No profiles exist
- **WHEN** the application is opened for the first time with no profiles
- **THEN** the system SHALL prompt the user to create their first profile

### Requirement: Profile management
The system SHALL allow creating, editing, and deleting profiles.

#### Scenario: Creating a profile
- **WHEN** user clicks "Add Profile" on the profile selector
- **THEN** the system SHALL present a form to enter a name and select an avatar (emoji or color)

#### Scenario: Editing a profile
- **WHEN** user edits an existing profile
- **THEN** the system SHALL allow changing the name, avatar, reading direction, and theme preference

#### Scenario: Deleting a profile
- **WHEN** user deletes a profile
- **THEN** the system SHALL remove the profile and all associated reading progress after confirmation

### Requirement: Reading progress tracking
The system SHALL track the last-read page for each volume per profile.

#### Scenario: Saving progress
- **WHEN** user navigates to a new page while reading
- **THEN** the system SHALL save the current page number for the active profile and volume

#### Scenario: Resuming reading
- **WHEN** user opens a volume they have previously read
- **THEN** the system SHALL open to the last-read page for the active profile

### Requirement: Continue Reading
The system SHALL display a "Continue Reading" section on the library page showing recently read volumes.

#### Scenario: Continue Reading display
- **WHEN** the active profile has reading progress on one or more volumes
- **THEN** the library page SHALL display a "Continue Reading" section at the top with the most recently read volumes, showing the series title, volume number, and progress percentage

#### Scenario: No reading history
- **WHEN** the active profile has no reading progress
- **THEN** the "Continue Reading" section SHALL not be displayed

### Requirement: Per-profile settings
Each profile SHALL have individual settings for reading direction and theme.

#### Scenario: Profile reading direction
- **WHEN** a profile has reading direction set to LTR
- **THEN** the reader SHALL use LTR navigation for that profile regardless of the app default

#### Scenario: Profile theme
- **WHEN** a profile has theme set to "light"
- **THEN** the application SHALL use the light theme while that profile is active
