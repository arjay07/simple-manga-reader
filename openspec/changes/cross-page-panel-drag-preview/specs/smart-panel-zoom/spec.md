## ADDED Requirements

### Requirement: Live cross-page panel drag preview

When Smart Panel Zoom is active, the reader is zoomed to a panel, and the user drags horizontally on a touch device from the boundary panel of the current page (last panel when dragging forward, first panel when dragging backward) toward an adjacent page that has panel data, the reader SHALL render a live preview in which the carousel strip translates with the finger and the neighboring page is shown zoomed to its target panel (first panel for forward, last panel for backward) — matching the "panel follows finger" feel of within-page panel drags.

The reader SHALL pre-render the neighbor page into the appropriate carousel slot (prev or next, chosen by reading direction the same way `slideToZoomedPage` does) as soon as the user becomes zoomed onto a boundary panel of the current page, so the preview can begin without waiting on a render at gesture start.

If the neighbor page has not finished pre-rendering by the time the gesture begins, the reader SHALL fall back to the pre-existing rubber-band-only drag with a post-release `slideToZoomedPage` transition.

#### Scenario: Drag from last panel forward shows next page following the finger

- **WHEN** the reader is zoomed to the last panel of the current page, the next page has panel data, the next page has been pre-rendered into its carousel slot, and the user drags horizontally toward the next page
- **THEN** the carousel strip SHALL translate with the finger so the neighbor slot moves into view
- **AND** the neighbor slot SHALL display the next page zoomed to its first panel using the pre-computed transform
- **AND** the current page SHALL remain at its start panel transform throughout the drag (no rubber-band)

#### Scenario: Drag from first panel backward shows previous page following the finger

- **WHEN** the reader is zoomed to the first panel of the current page, the previous page has panel data, the previous page has been pre-rendered into its carousel slot, and the user drags horizontally toward the previous page
- **THEN** the carousel strip SHALL translate with the finger so the neighbor slot moves into view
- **AND** the neighbor slot SHALL display the previous page zoomed to its last panel using the pre-computed transform

#### Scenario: Commit on release past the threshold

- **WHEN** the user releases a cross-page drag whose horizontal distance exceeds the commit threshold or whose velocity exceeds the fast-flick threshold
- **THEN** the carousel strip SHALL finish sliding to the neighbor slot
- **AND** the reader SHALL adopt the neighbor page as the current page with the target panel and stop active, the same way `slideToZoomedPage` commits today

#### Scenario: Cancel on release before the threshold

- **WHEN** the user releases a cross-page drag whose horizontal distance is below the commit threshold and whose velocity is below the fast-flick threshold
- **THEN** the carousel strip SHALL spring back to its center position
- **AND** the current page SHALL remain at its boundary panel with no page change

#### Scenario: Fallback when neighbor not pre-rendered

- **WHEN** the user begins a cross-page drag but the neighbor page has not yet finished pre-rendering
- **THEN** the reader SHALL apply the existing rubber-band resistance to the current panel during the drag
- **AND** on commit the reader SHALL invoke `slideToZoomedPage` to perform the post-release strip slide

#### Scenario: Vertical swipe still navigates by page

- **WHEN** the user's drag is predominantly vertical (vertical delta exceeds horizontal delta)
- **THEN** the cross-page drag preview SHALL NOT engage
- **AND** existing vertical-swipe navigation behavior SHALL apply
