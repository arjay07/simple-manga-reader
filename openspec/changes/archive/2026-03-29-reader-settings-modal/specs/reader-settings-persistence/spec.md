## ADDED Requirements

### Requirement: JSON settings column on profiles
The profiles table SHALL have a `reader_settings` TEXT column defaulting to `'{}'`. All reader preferences SHALL be stored as a JSON object in this column.

#### Scenario: New profile has empty settings
- **WHEN** a new profile is created
- **THEN** the `reader_settings` column contains `'{}'`

#### Scenario: Settings stored as JSON
- **WHEN** a user changes reading direction to LTR and enables tap-to-turn
- **THEN** the `reader_settings` column contains `{"readingDirection":"ltr","tapToTurn":true}`

### Requirement: Default values for missing keys
When loading reader settings, the system SHALL merge stored settings over a defaults object so that any missing keys fall back to defaults.

#### Scenario: Partial settings merged with defaults
- **WHEN** a profile has `reader_settings` of `{"tapToTurn":true}` and defaults are `{"readingDirection":"rtl","tapToTurn":false,"pageMode":"single"}`
- **THEN** the effective settings are `{"readingDirection":"rtl","tapToTurn":true,"pageMode":"single"}`

#### Scenario: Empty settings use all defaults
- **WHEN** a profile has `reader_settings` of `'{}'`
- **THEN** all settings use their default values (readingDirection: rtl, tapToTurn: false, pageMode: single)

### Requirement: Settings persist across sessions
Reader settings saved for a profile SHALL persist and be restored when the same profile loads the reader again.

#### Scenario: Settings restored on reload
- **WHEN** a user sets reading direction to Vertical, closes the reader, and reopens it
- **THEN** the reader loads in vertical scroll mode

### Requirement: Backward compatibility with reading_direction column
The existing `reading_direction` column SHALL serve as a fallback. If `reader_settings` has a `readingDirection` key, it takes precedence. Otherwise, the column value is used.

#### Scenario: JSON overrides column
- **WHEN** a profile has `reading_direction` column set to `'rtl'` and `reader_settings` contains `{"readingDirection":"ltr"}`
- **THEN** the effective reading direction is LTR

#### Scenario: Column used as fallback
- **WHEN** a profile has `reading_direction` column set to `'ltr'` and `reader_settings` is `'{}'`
- **THEN** the effective reading direction is LTR

### Requirement: Settings saved via API
Reader settings SHALL be saved via PUT to `/api/profiles/[id]` with the `reader_settings` JSON. Saves SHALL be debounced on the client.

#### Scenario: Debounced save on change
- **WHEN** the user rapidly changes multiple settings
- **THEN** only one API call is made after the user stops changing settings (debounced)
