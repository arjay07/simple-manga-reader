## 1. Admin Mode Foundation

- [x] 1.1 Create `AdminProvider` context component (`src/components/AdminProvider.tsx`) with `isAdmin` state, `toggleAdmin` function, and localStorage persistence under key `admin-mode`
- [x] 1.2 Create `useAdmin` hook for consuming the admin context
- [x] 1.3 Add `AdminProvider` to the provider stack in `src/app/layout.tsx` (ThemeProvider → AdminProvider → ProfileProvider → children)

## 2. Header Menu

- [x] 2.1 Create `HeaderMenu` component (`src/components/HeaderMenu.tsx`) with a ⋮ button that opens a dropdown menu
- [x] 2.2 Add click-outside and Escape key dismissal to the dropdown
- [x] 2.3 Move Theme toggle into the dropdown as a menu item (reuse `useTheme` logic from existing `ThemeToggle`)
- [x] 2.4 Move Rescan into the dropdown as a menu item (reuse logic from existing `RescanButton`)
- [x] 2.5 Add Admin Mode toggle (switch) as a menu item using `useAdmin`
- [x] 2.6 Replace the separate Rescan button and ThemeToggle in the library page header (`src/app/library/page.tsx`) with `HeaderMenu`
- [x] 2.7 Replace the ThemeToggle in the series detail page header (`src/app/library/[seriesId]/page.tsx`) with `HeaderMenu`

## 3. Volume Thumbnail API

- [x] 3.1 Create utility function to check if `pdftoppm` is available on the system (`src/lib/pdf-utils.ts`)
- [x] 3.2 Create utility function to extract page 1 of a PDF as JPEG using `pdftoppm` at 150 DPI
- [x] 3.3 Ensure `public/covers/volumes/` directory is created on first use
- [x] 3.4 Create `GET /api/manga/[seriesId]/[volumeId]/thumbnail/route.ts` that checks for cached thumbnail, generates if missing, and returns the image

## 4. Volume Thumbnail Display

- [x] 4.1 Update volume cards in the series detail page (`src/app/library/[seriesId]/page.tsx`) to display thumbnails from the API with fallback to numbered placeholder on error
- [x] 4.2 Update volume cards in the Continue Reading section (`src/app/library/page.tsx`) to display thumbnails from the API with fallback

## 5. Cover Art Management API

- [x] 5.1 Extend `POST /api/manga/[seriesId]/cover/route.ts` to accept JSON body with `{ url: string }` — download the image server-side with content-type validation and 10MB size limit
- [x] 5.2 Create `POST /api/manga/[seriesId]/cover/generate/route.ts` endpoint that extracts page 1 from Volume 1 using the pdf-utils and saves as the series cover

## 6. Cover Art Management UI

- [x] 6.1 Create `SeriesCardMenu` component (`src/components/Library/SeriesCardMenu.tsx`) — a ⋮ overlay button on the cover image with dropdown containing Upload Cover, Set Cover from URL, Auto-generate Cover
- [x] 6.2 Implement "Upload Cover" option — file input trigger, multipart POST to existing cover endpoint, refresh cover on success
- [x] 6.3 Implement "Set Cover from URL" option — prompt/modal for URL input, JSON POST to cover endpoint, refresh cover on success
- [x] 6.4 Implement "Auto-generate Cover" option — POST to generate endpoint, refresh cover on success
- [x] 6.5 Integrate `SeriesCardMenu` into `SeriesCard` component — conditionally render when `isAdmin` is true
- [x] 6.6 Add error handling and user feedback (toast/inline) for all cover operations
