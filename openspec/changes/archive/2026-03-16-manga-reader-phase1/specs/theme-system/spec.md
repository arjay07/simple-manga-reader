## ADDED Requirements

### Requirement: Dark mode by default
The system SHALL use dark mode as the default theme for all new profiles and unauthenticated views.

#### Scenario: First visit
- **WHEN** a user visits the application without a profile selected
- **THEN** the UI SHALL render in dark mode

#### Scenario: New profile default
- **WHEN** a new profile is created
- **THEN** the theme preference SHALL default to "dark"

### Requirement: Theme toggle
The system SHALL provide a toggle to switch between dark and light modes.

#### Scenario: Switching to light mode
- **WHEN** user toggles the theme to light mode
- **THEN** the UI SHALL immediately switch to light colors without a page reload

#### Scenario: Theme persistence
- **WHEN** user changes their theme preference
- **THEN** the preference SHALL be saved to the active profile and persist across sessions

### Requirement: Theme styling
The system SHALL implement theming using CSS custom properties for consistent color changes.

#### Scenario: Dark mode colors
- **WHEN** dark mode is active
- **THEN** the UI SHALL use dark backgrounds, light text, and appropriate contrast ratios for readability

#### Scenario: Light mode colors
- **WHEN** light mode is active
- **THEN** the UI SHALL use light backgrounds, dark text, and appropriate contrast ratios for readability

#### Scenario: Reader background
- **WHEN** reading a manga in either theme
- **THEN** the reader background SHALL be dark/black regardless of theme setting to provide optimal contrast for manga pages
