## Context

The manga reader is a Next.js 16 app served on a local network. It has no PWA infrastructure — no manifest, no service worker, no icons. The user has a pre-generated icon set at `C:\Users\RJ\Downloads\simple-manga-reader-icons` with iOS (square) and web variants. The iOS square icons are preferred for the PWA.

## Goals / Non-Goals

**Goals:**
- Make the app installable via "Add to Home Screen" on iOS and Android
- Display in standalone mode (no browser chrome)
- Use the existing iOS icon set (square Dragon Ball icon) for all platforms

**Non-Goals:**
- Offline support (no asset caching, no offline reading)
- Push notifications
- Background sync
- Precaching or runtime caching strategies

## Decisions

### 1. Native Next.js manifest route over library
**Choice:** Use `src/app/manifest.ts` (Next.js built-in) instead of `next-pwa` or `@serwist/next`.
**Rationale:** A basic PWA only needs a manifest and a minimal service worker. Libraries add complexity and dependencies for caching strategies we don't need. The native approach is zero-dependency and fully sufficient.

### 2. Hand-written minimal service worker
**Choice:** A static `public/sw.js` with empty install/activate/fetch handlers.
**Rationale:** Chrome requires a service worker with a fetch handler to show the install prompt. We don't need caching — just the bare minimum to satisfy installability. A static file in `public/` is simpler than build-time generation.

### 3. Icon sourcing from iOS set
**Choice:** Use `ios/AppIcon~ios-marketing.png` (1024x1024) resized to 192 and 512 for manifest icons. Use `ios/AppIcon@3x.png` (180x180) as the Apple touch icon. Keep `web/favicon.ico` for the browser tab.
**Rationale:** The iOS icons are square with full-bleed art. The web icons have a circular crop with transparency that doesn't fill the icon area well. The square icons will also serve as maskable icons since they fill the safe zone.

### 4. Theme color matches app accent
**Choice:** Use `#e06515` (the app's `--accent` color) as `theme_color` and `background_color` in the manifest.
**Rationale:** Matches the icon's orange palette and the app's existing accent color for a cohesive look.

### 5. Service worker registration via inline script
**Choice:** Register the SW in an inline `<script>` in `layout.tsx` (alongside the existing dark mode script).
**Rationale:** Keeps registration simple with no client component needed. The existing pattern of inline scripts in `<head>` is already established.

## Risks / Trade-offs

- **No offline support** → Users see a browser error if the network is unavailable. Acceptable for a local-network app.
- **Icon resizing needed** → Must resize 1024px icon to 192 and 512. Can use ImageMagick/sharp at dev time, or provide pre-resized files.
- **iOS PWA limitations** → iOS Safari has limited PWA support (no install prompt, must use Share → Add to Home Screen). No mitigation needed — this is a platform constraint.
