## ADDED Requirements

### Requirement: Vertical mode supports optional snap-to-page on touch release
When the `verticalSnap` reader setting is enabled, the vertical scroll view SHALL snap the scroll position to the nearest page boundary after the user lifts their finger.

#### Scenario: Snap fires on touch release when enabled
- **WHEN** the user lifts their finger while scrolling in vertical mode and `verticalSnap` is `true`
- **THEN** the reader SHALL call `scrollTo({ top: nearestPageTop, behavior: 'smooth' })` where `nearestPageTop` is the `offsetTop` of the canvas whose center is closest to the viewport center at the moment of release

#### Scenario: No snap when setting is disabled
- **WHEN** the user lifts their finger while scrolling in vertical mode and `verticalSnap` is `false`
- **THEN** the scroll position SHALL be left wherever the browser's natural momentum brings it

#### Scenario: Programmatic scroll (e.g. scrub bar) does not trigger snap
- **WHEN** the scrub bar or any programmatic `scrollTo` causes a scroll in vertical mode
- **THEN** the subsequent `touchend` event (if any) SHALL NOT trigger snap behavior for that scroll

### Requirement: verticalSnap is a persisted reader setting
The `verticalSnap` boolean SHALL be part of `ReaderSettings`, defaulting to `false`, and SHALL be saved to the profile's `reader_settings` JSON blob.

#### Scenario: Default value is false
- **WHEN** a profile has no `verticalSnap` value stored
- **THEN** `parseReaderSettings` SHALL return `verticalSnap: false`

#### Scenario: Setting persists across sessions
- **WHEN** the user toggles vertical snap on and navigates away
- **THEN** the setting SHALL be present in the profile's `reader_settings` on next load

### Requirement: Vertical snap toggle is available in reader settings modal
A toggle for "Snap to Pages" SHALL be visible in the reader settings modal when the reading direction is vertical.

#### Scenario: Toggle only shown in vertical mode
- **WHEN** the reading direction is `vertical`
- **THEN** a "Snap to Pages" toggle SHALL be visible in the settings modal
- **WHEN** the reading direction is `ltr` or `rtl`
- **THEN** the "Snap to Pages" toggle SHALL NOT be visible
