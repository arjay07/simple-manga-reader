## MODIFIED Requirements

### Requirement: Letterbox animation on panel transitions

The letterbox SHALL animate its framing rect smoothly during panel-to-panel transitions and user gestures, including cross-page panel transitions. When a transition is driven by a CSS animation on another element (e.g. the carousel strip's transform during a cross-page slide), the letterbox bar geometry SHALL transition with the same duration and easing curve as that driving animation, so the bars stay visually phase-locked to the panel they frame at every intermediate frame.

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

#### Scenario: Cross-page letterbox morph stays phase-locked with the strip slide

- **WHEN** the carousel strip is animating across a page boundary as part of a cross-page panel transition (any input method — touch drag commit, keyboard, mouse wheel, tap-to-turn, arrow button)
- **THEN** the letterbox bar geometry SHALL transition with the same duration and easing curve as the strip's `transform` transition
- **AND** at every intermediate frame the bars SHALL frame the panel currently centered in the viewport, with no visible lead or lag relative to the panel's motion
- **AND** the previous behavior of using a hand-rolled cubic ease-out via a per-frame requestAnimationFrame loop SHALL no longer be used for cross-page letterbox morph

#### Scenario: Cross-page drag preview tracks the strip during a live touch drag

- **WHEN** the user is progressively dragging across a page boundary on touch (carousel strip translating with the finger)
- **THEN** the letterbox SHALL interpolate alongside the strip's translation each frame so the bars stay glued to whichever panel is currently centered in the viewport
- **AND** the bars SHALL NOT fade out during the drag

#### Scenario: Cross-page drag cancelled before commit

- **WHEN** a cross-page drag is released below the commit threshold and the carousel strip springs back to center
- **THEN** the letterbox SHALL spring back to fully frame the start panel of the current page using the same duration and easing curve as the strip's spring-back transition

#### Scenario: Cross-page drag committed

- **WHEN** a cross-page drag is released past the commit threshold and the strip finishes sliding to the neighbor slot
- **THEN** the letterbox SHALL settle on the to-rect (neighbor page's target panel) without a visible re-render snap after the strip transition completes

#### Scenario: Letterbox tracks pinch gestures

- **WHEN** the user pinches while the letterbox is visible and the final pinch scale remains above the fit threshold
- **THEN** the letterbox edges SHALL follow the live wrapper transform frame by frame with no visible lag

#### Scenario: Letterbox tracks within-page panel-drag preview

- **WHEN** the user swipes progressively between panels on the same page and the reader is rendering an interpolated preview transform
- **THEN** the letterbox SHALL interpolate alongside the preview so it stays glued to the visible panel rect

#### Scenario: Fade on enter

- **WHEN** Focus Mode or Smart Panel Zoom is first turned on while the reader is already zoomed to a panel
- **THEN** the letterbox SHALL fade in from opacity 0 to full opacity over approximately 150 ms

#### Scenario: Fade on exit

- **WHEN** Focus Mode is turned off, Smart Panel Zoom is turned off, the user exits panel zoom to full page, or panel zoom becomes paused
- **THEN** the letterbox SHALL fade out to opacity 0 over approximately 150 ms before being removed
