## ADDED Requirements

### Requirement: AdminProvider context
The system SHALL provide an `AdminProvider` React context that exposes an `isAdmin` boolean and a `toggleAdmin` function to all child components.

#### Scenario: Admin mode defaults to off
- **WHEN** a user visits the app for the first time
- **THEN** `isAdmin` SHALL be `false`

#### Scenario: Admin state persists across page loads
- **WHEN** a user enables admin mode
- **THEN** the state SHALL be saved to localStorage under key `admin-mode`
- **AND** on next page load, `isAdmin` SHALL be `true`

### Requirement: Admin mode toggle UI
The system SHALL display an Admin Mode toggle (switch/checkbox) inside the header dropdown menu.

#### Scenario: Toggling admin mode on
- **WHEN** the user clicks the Admin Mode toggle in the header menu
- **THEN** `isAdmin` SHALL become `true`
- **AND** admin-only UI elements SHALL become visible

#### Scenario: Toggling admin mode off
- **WHEN** the user clicks the Admin Mode toggle while admin mode is active
- **THEN** `isAdmin` SHALL become `false`
- **AND** admin-only UI elements SHALL be hidden

### Requirement: No authentication required
Admin mode SHALL NOT require any password, PIN, or authentication. It is a simple UI toggle.

#### Scenario: No auth prompt
- **WHEN** the user toggles admin mode on
- **THEN** no authentication dialog SHALL be shown
