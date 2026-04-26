## MODIFIED Requirements

### Requirement: Letterbox animation on panel transitions

The letterbox SHALL animate its framing rect smoothly during panel-to-panel transitions and user gestures, including cross-page panel transitions driven by a live touch drag preview.

#### Scenario: Advance to next panel on the same page

- **WHEN** the user taps to advance from one panel to another on the same page
- **THEN** the letterbox edges SHALL animate from the previous padded rect to the new padded rect over approximately 200 ms with an ease-out curve

#### Scenario: Advance between stops of the same multi-stop panel

- **WHEN** the user taps to advance from one stop to another stop of the same panel
- **THEN** the letterbox frame SHALL remain visually stationary (every stop's clamped projected rect is identical because the panel's width at multi-stop zoom exceeds the viewport and its vertical extent is pan-invariant)
- **AND** the panel content underneath SHALL pan to the new stop

#### Scenario: Letterbox stays synced with the wrapper during panel-change animations

- **WHEN** the wrapper is animating its transform from one panel's position to the next over approximately 200 ms
- **THEN** the letterbox bars SHALL transition their geometry over the same duration and curve
- **AND** because the bar rect is a linear projection of the wrapper transform, the bars SHALL remain visually aligned with the moving panel throughout the animation (no dark coverage of content that has already entered the viewport)

#### Scenario: Advance across a page boundary via tap or button (no live drag)

- **WHEN** advancing to a panel on a different page triggers a `slideToZoomedPage` strip-slide transition without a live touch drag in progress
- **THEN** the letterbox SHALL fade out before or during the slide
- **AND** the letterbox SHALL fade back in framing the new panel once the new page is settled

#### Scenario: Letterbox tracks the within-page panel-drag preview

- **WHEN** the user progressively drags toward an adjacent panel on the same page (the interpolated transform preview)
- **THEN** the letterbox rect SHALL interpolate between the current panel's projection (at the drag-start transform) and the target panel's projection (at its canonical transform) by the drag progress
- **AND** the bars SHALL continuously encase whichever panel is visually predominant at each frame, with neither the outgoing nor incoming panel covered by stale bars

#### Scenario: Letterbox tracks the cross-page panel-drag preview

- **WHEN** the user progressively drags from the boundary panel of the current page toward a panel on an adjacent page that is being previewed via the live cross-page drag (carousel strip translating with the finger)
- **THEN** the letterbox SHALL compute a from-rect by projecting the current page's start panel through its drag-start transform, and a to-rect by projecting the neighbor page's target panel through its pre-computed transform
- **AND** the letterbox SHALL offset both rects by the strip's current horizontal translation each frame so each rect tracks its page slot through the slide
- **AND** the visible letterbox rect SHALL be the linear interpolation of these two adjusted rects by the drag progress, so the bars frame whichever panel is currently centered in the viewport
- **AND** the bars SHALL NOT fade out during the drag

#### Scenario: Cross-page drag cancelled before commit

- **WHEN** a cross-page drag is released below the commit threshold and the carousel strip springs back to center
- **THEN** the letterbox SHALL spring back along the same drag-progress curve to fully frame the start panel of the current page

#### Scenario: Cross-page drag committed

- **WHEN** a cross-page drag is released past the commit threshold and the strip finishes sliding to the neighbor slot
- **THEN** the letterbox SHALL settle on the to-rect (neighbor page's target panel), without a fade-out/fade-in cycle, since the bars have been continuously tracking the to-rect through the drag

#### Scenario: Letterbox tracks pinch gestures

- **WHEN** the user pinches while the letterbox is visible and the final pinch scale remains above the fit threshold
- **THEN** the letterbox edges SHALL follow the live wrapper transform frame by frame with no visible lag

#### Scenario: Letterbox tracks panel-drag preview

- **WHEN** the user swipes progressively between panels and the reader is rendering an interpolated preview transform
- **THEN** the letterbox SHALL interpolate alongside the preview so it stays glued to the visible panel rect

#### Scenario: Fade on enter

- **WHEN** Focus Mode or Smart Panel Zoom is first turned on while the reader is already zoomed to a panel
- **THEN** the letterbox SHALL fade in from opacity 0 to full opacity over approximately 150 ms

#### Scenario: Fade on exit

- **WHEN** Focus Mode is turned off, Smart Panel Zoom is turned off, the user exits panel zoom to full page, or panel zoom becomes paused
- **THEN** the letterbox SHALL fade out to opacity 0 over approximately 150 ms before being removed
