## 1. Icon Assets

- [x] 1.1 Resize `ios/AppIcon~ios-marketing.png` (1024x1024) to 192x192 and save as `public/icon-192.png`
- [x] 1.2 Resize `ios/AppIcon~ios-marketing.png` (1024x1024) to 512x512 and save as `public/icon-512.png`
- [x] 1.3 Copy resized icons as maskable variants: `public/icon-192-maskable.png` and `public/icon-512-maskable.png`
- [x] 1.4 Copy `ios/AppIcon@3x.png` (180x180) to `public/apple-touch-icon.png`
- [x] 1.5 Copy `web/favicon.ico` to `public/favicon.ico`

## 2. Web App Manifest

- [x] 2.1 Create `src/app/manifest.ts` that exports a Next.js metadata manifest with name, short_name, description, start_url, display, theme_color, background_color, and icons array

## 3. Service Worker

- [x] 3.1 Create `public/sw.js` with minimal install, activate, and fetch event listeners (no caching logic)

## 4. Layout Meta Tags and SW Registration

- [x] 4.1 Add PWA meta tags to `src/app/layout.tsx`: theme-color, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style
- [x] 4.2 Add link elements to layout: apple-touch-icon, favicon
- [x] 4.3 Add inline service worker registration script to `<head>` in layout.tsx

## 5. Verification

- [x] 5.1 Run `npm run build` to verify the app compiles successfully
