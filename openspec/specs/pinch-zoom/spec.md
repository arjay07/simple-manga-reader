# pinch-zoom Specification

## Purpose

Users instinctively pinch to zoom on touch devices, but the reader previously only supported zoom via double-tap. Users — including those in smart panel mode, where automated zoom is already doing a lot of work for them — were regularly observed trying to pinch and getting no response, which read as a broken interface. This capability adds two-finger pinch-to-zoom in the paginated reader (regular and smart panel), driving the existing zoom state machine so the pinch gesture integrates cleanly with double-tap zoom, single-finger pan, and panel-by-panel navigation. Vertical/webtoon and spread modes are explicitly out of scope.

## Requirements

### Requirement: Two-finger pinch-to-zoom
In paginated reader single-page carousel mode, the reader SHALL enter or adjust zoom in response to a two-finger pinch gesture. The gesture SHALL drive the same CSS transform state (`zoomScaleRef`, `zoomOriginRef`, `panRef`, `applyZoomTransform`) used by the existing double-tap zoom. Vertical and spread modes are out of scope.

#### Scenario: Pinch-in from full-page view
- **WHEN** the reader is unzoomed and the user places two fingers on the screen and moves them apart
- **THEN** the reader SHALL enter the zoomed state, anchoring the zoom origin to the canvas-local point beneath the initial two-finger midpoint
- **AND** the scale SHALL increase continuously as the fingers spread

#### Scenario: Pinch adjusts scale when already zoomed
- **WHEN** the reader is already zoomed (from a previous double-tap or pinch) and the user pinches
- **THEN** the scale SHALL change relative to the scale at the moment the second finger touched down
- **AND** the zoom origin and pan SHALL remain anchored so the page point under the initial midpoint stays under the current midpoint

#### Scenario: Two-finger midpoint translation pans while pinching
- **WHEN** the user moves the midpoint of their two fingers during a pinch
- **THEN** the zoomed content SHALL translate so the page point under the initial midpoint remains under the current midpoint

### Requirement: Pinch scale clamping
The reader SHALL clamp pinch scale to the range `[fit, 5×]`, where `fit` is the natural CSS-fit scale of the canvas (equivalent to `zoomScaleRef.current === 1` in the transform model).

#### Scenario: Pinch-out above 5×
- **WHEN** the user continues pinching outward past 5× scale
- **THEN** the visible scale SHALL NOT exceed 5×

#### Scenario: Pinch-in to below fit exits zoom on release
- **WHEN** the user pinches to below the fit scale (with a small hysteresis) and releases
- **THEN** the reader SHALL exit zoom back to the full-page view via the existing `exitZoom` path

#### Scenario: Pinch-in dips below fit mid-gesture but ends above fit
- **WHEN** the user pinches below the fit scale and then back above before releasing
- **THEN** the reader SHALL remain zoomed at the final scale

### Requirement: Hi-res canvas re-render on pinch end
After a pinch gesture ends above the exit threshold, the reader SHALL re-render the current PDF page canvas at a backing resolution appropriate for the final scale (same path used by double-tap zoom and smart panel zoom).

#### Scenario: Pinch ends above fit
- **WHEN** the user completes a pinch with final scale above the exit threshold
- **THEN** the canvas SHALL be re-rendered at `min(scale, 4) × devicePixelRatio × baseScale`
- **AND** the CSS transform SHALL apply the final scale and pan without transition disruption

#### Scenario: Pinch ends below fit
- **WHEN** the user completes a pinch with final scale below the fit threshold
- **THEN** the reader SHALL exit zoom and SHALL NOT trigger a hi-res re-render at the zoomed level

### Requirement: Seamless transition from two-finger to one-finger gesture
When a pinch gesture ends with one finger still on screen, the reader SHALL commit the pinch (clamp scale, apply pan bounds, schedule re-render) and SHALL allow the remaining finger to continue as a single-finger pan without a visible jump or state reset.

#### Scenario: User lifts one finger mid-pinch and keeps panning
- **WHEN** the user pinches to zoom, then lifts one finger, then drags with the remaining finger
- **THEN** the zoomed state SHALL be preserved at the scale reached during the pinch
- **AND** the remaining finger's movement SHALL pan the zoomed canvas (clamped to `computePanBounds`)

### Requirement: Pinch-gesture gating of single-finger handlers
When a pinch is active (`pinchStateRef` is set), the single-finger branches of `handleTouchMove` and `handleTouchEnd` (swipe-to-navigate, single-finger zoom-pan, panel drag, strip drag) SHALL NOT fire. When the pinch ends, the reader SHALL NOT interpret the ending touch as a swipe, even if the motion would otherwise meet swipe thresholds.

#### Scenario: Fast pinch release does not trigger swipe navigation
- **WHEN** the user quickly releases a pinch with high lateral velocity
- **THEN** the reader SHALL NOT navigate to the next or previous page

#### Scenario: In-flight strip animation is cancelled by pinch start
- **WHEN** the user begins a pinch while a strip slide animation is in flight
- **THEN** the animation SHALL be cancelled and the pinch SHALL take over at the current visual position

### Requirement: Viewport meta suppresses native browser pinch
The app's viewport metadata SHALL disable the browser's native page-level pinch-to-zoom, so the reader's pinch handler has exclusive control of the gesture.

#### Scenario: iOS Safari does not overlay its own pinch
- **WHEN** a user pinches in the reader on iOS Safari
- **THEN** the browser SHALL NOT scale the page chrome; only the reader's pinch handler SHALL respond
