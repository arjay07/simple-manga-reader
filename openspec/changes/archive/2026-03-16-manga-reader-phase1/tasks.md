## 1. Project Setup

- [x] 1.1 Initialize Next.js project with TypeScript, Tailwind CSS, and App Router
- [x] 1.2 Install dependencies: pdfjs-dist, better-sqlite3, @types/better-sqlite3
- [x] 1.3 Configure environment variables (MANGA_DIR, DATABASE_PATH) with .env.local
- [x] 1.4 Create `~/manga/Dragon Ball/` directory and move PDFs from gdrive_downloads
- [x] 1.5 Set up project folder structure (src/app, src/components, src/lib, data/, public/covers/)

## 2. Database & Storage Layer

- [x] 2.1 Create SQLite database initialization module (src/lib/db.ts) with schema creation
- [x] 2.2 Implement manga folder scanner (src/lib/scanner.ts) that reads MANGA_DIR and populates series/volumes tables
- [x] 2.3 Implement volume number extraction from filenames (regex-based)
- [x] 2.4 Create API route for PDF file serving with streaming (GET /api/manga/[seriesId]/[volumeId]/pdf)
- [x] 2.5 Run initial scan on app startup to populate database

## 3. Theme System

- [x] 3.1 Set up CSS custom properties for dark/light themes in globals.css
- [x] 3.2 Implement ThemeProvider context with dark mode as default
- [x] 3.3 Create theme toggle component
- [x] 3.4 Configure Tailwind dark mode with class strategy

## 4. PDF Reader

- [x] 4.1 Create Reader component with pdf.js rendering (single page mode)
- [x] 4.2 Implement touch swipe gesture handling for page navigation
- [x] 4.3 Implement keyboard arrow key navigation with reading direction awareness
- [x] 4.4 Add RTL/LTR reading direction support (RTL default)
- [x] 4.5 Implement two-page spread mode toggle for desktop viewports (>1024px)
- [x] 4.6 Add page indicator overlay (Page X of Y) with auto-hide behavior
- [x] 4.7 Create reader route at /read/[seriesId]/[volumeId]/page.tsx

## 5. Library View

- [x] 5.1 Create API routes for listing series (GET /api/manga) and volumes (GET /api/manga/[seriesId])
- [x] 5.2 Implement cover art extraction using pdf.js (first page of first volume → JPEG)
- [x] 5.3 Create series card component with cover image and title
- [x] 5.4 Build responsive library grid page at /library/page.tsx
- [x] 5.5 Create series detail view showing all volumes
- [x] 5.6 Add manual rescan button with API endpoint (POST /api/manga/scan)
- [x] 5.7 Implement custom cover upload (POST /api/manga/[seriesId]/cover)

## 6. Profile System

- [x] 6.1 Create API routes for profile CRUD (GET/POST/PUT/DELETE /api/profiles)
- [x] 6.2 Build Netflix-style profile selector page at / (root route)
- [x] 6.3 Implement profile creation form with name and avatar (emoji/color) selection
- [x] 6.4 Create ProfileProvider context to track active profile across the app
- [x] 6.5 Implement reading progress save/load API (POST/GET /api/progress)
- [x] 6.6 Auto-save reading progress on page navigation in the Reader component
- [x] 6.7 Build "Continue Reading" section on library page with recent volumes
- [x] 6.8 Implement per-profile reading direction and theme preferences

## 7. Network & Polish

- [x] 7.1 Configure Next.js to bind to 0.0.0.0 for local network access
- [x] 7.2 Add empty state messaging for library (no manga found) and profiles (no profiles yet)
- [x] 7.3 Add loading states and error handling for PDF rendering and API calls
- [x] 7.4 Test responsive layout across phone, tablet, and desktop viewports
