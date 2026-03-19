## Why

The manga reader is a content consumption app that benefits from feeling native on mobile devices. Users should be able to install it to their home screen and use it without browser chrome (URL bar, tabs), making it feel like a dedicated app on phones and tablets.

## What Changes

- Add a web app manifest (`manifest.ts`) with app name, theme colors, and icons
- Add a minimal service worker to satisfy browser installability criteria
- Add PWA meta tags and favicon links to the root layout
- Copy icon assets (resized from iOS icon set) into `public/`
- The app becomes installable via "Add to Home Screen" on iOS and Android

## Capabilities

### New Capabilities
- `pwa-installability`: Web app manifest, service worker registration, PWA meta tags, and icon assets that make the app installable as a standalone PWA

### Modified Capabilities
None.

## Impact

- **New files**: `src/app/manifest.ts`, `public/sw.js`, icon PNGs in `public/`
- **Modified files**: `src/app/layout.tsx` (meta tags, SW registration script)
- **Dependencies**: None added — uses Next.js built-in manifest route and a hand-written service worker
- **APIs**: No API changes
