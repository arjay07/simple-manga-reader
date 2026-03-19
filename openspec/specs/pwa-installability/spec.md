# PWA Installability

## Requirement: Web app manifest
The app SHALL serve a valid web app manifest at `/manifest.webmanifest` (via Next.js manifest route) containing the app name, description, start URL, display mode, theme color, background color, and icon references.

### Scenario: Manifest is served
- **WHEN** a browser requests `/manifest.webmanifest`
- **THEN** the response SHALL be a valid JSON manifest with `display: "standalone"`, `start_url: "/"`, `theme_color: "#e06515"`, and `background_color: "#e06515"`

### Scenario: Manifest includes icons
- **WHEN** a browser parses the manifest
- **THEN** it SHALL find icons at sizes 192x192 and 512x512 in PNG format, plus maskable variants at the same sizes

## Requirement: Service worker registration
The app SHALL register a service worker on page load so that browsers recognize the app as installable.

### Scenario: Service worker registers on load
- **WHEN** a user loads any page in a browser that supports service workers
- **THEN** the browser SHALL register `/sw.js` as a service worker

### Scenario: Service worker has fetch handler
- **WHEN** the service worker is active
- **THEN** it SHALL have a fetch event listener (required for Chrome installability)

## Requirement: PWA meta tags
The root HTML layout SHALL include meta tags and link elements for PWA support across browsers.

### Scenario: Meta tags present in HTML head
- **WHEN** a page is rendered
- **THEN** the HTML `<head>` SHALL contain `<meta name="theme-color" content="#e06515">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, and `<link rel="icon" href="/favicon.ico" sizes="any">`

## Requirement: Icon assets
The `public/` directory SHALL contain all required icon files for PWA installability.

### Scenario: All icon files present
- **WHEN** the app is deployed
- **THEN** the following files SHALL exist: `favicon.ico`, `apple-touch-icon.png` (180x180), `icon-192.png` (192x192), `icon-512.png` (512x512), `icon-192-maskable.png` (192x192), `icon-512-maskable.png` (512x512)

## Requirement: Standalone display mode
The app SHALL launch without browser chrome when installed to the home screen.

### Scenario: Installed app opens in standalone mode
- **WHEN** a user installs the app and launches it from their home screen
- **THEN** the app SHALL display without the browser URL bar, tabs, or navigation controls
