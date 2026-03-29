## MODIFIED Requirements

### Requirement: Panel-by-panel navigation
When smart panel zoom is active and panel data is available for the current page, all navigation inputs (tap, click, swipe, keyboard, scroll wheel, arrow buttons) SHALL navigate to the next panel in reading order by zooming to that panel's bounding box.

#### Scenario: Navigate to next panel
- **WHEN** the user navigates forward and there are more panels on the current page
- **THEN** the view SHALL zoom/pan to the next panel in reading order

#### Scenario: Last panel on page
- **WHEN** the user navigates forward on the last panel of a page
- **THEN** the reader SHALL advance to the next page and zoom to the first panel

#### Scenario: Page with no panels (full-bleed/cover)
- **WHEN** the current page has `pageType` of "full-bleed", "cover", or "blank" and the user navigates forward
- **THEN** the reader SHALL advance to the next page; if the next page has panels, it SHALL pre-render the page zoomed to the first panel and slide it in seamlessly (no flash of unzoomed content)

#### Scenario: Non-panel to panel page transition
- **WHEN** the user navigates forward from a non-panel page and the next page has `pageType === 'panels'`
- **THEN** the reader SHALL pre-render the next page's canvas at hi-res zoomed to the first panel's bounding box, apply the zoom transform to the carousel slot, and slide the strip to reveal it — identical to the existing panel→panel cross-page transition

#### Scenario: Panel to non-panel page transition
- **WHEN** the user navigates forward from the last panel on a page and the next page has no panels
- **THEN** the reader SHALL exit zoom, slide to the next page at full-page view using the carousel animation, and not attempt to auto-zoom

#### Scenario: Non-panel to non-panel page transition
- **WHEN** the user navigates forward from a non-panel page and the next page also has no panels
- **THEN** the reader SHALL use the standard carousel slide animation (same as non-panel-zoom mode)
