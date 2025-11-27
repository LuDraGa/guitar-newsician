# Library UI Build - Execution Document

**Date**: 2025-11-27
**Task**: Build library UI with table/card views and smart search

## Requirements

### Views
- [ ] Table view with title, artists, status pills
- [ ] Card view with video thumbnail as background, title, artists, status pills
- [ ] View toggle between table and cards

### Search Functionality
- [ ] Search by title
- [ ] Search by artist names
- [ ] Search by YT URL
- [ ] Search by YT Music URL
- [ ] URL detection
- [ ] Show download button when search is URL and no match found

### Design
- [ ] Glassmorphic design (like landing page nav)
- [ ] 60-30-10 color palette (from existing theme)
- [ ] Consistent fontface and spacing
- [ ] Responsive layout

### Data Integration
- [ ] Load songs from downloads directory
- [ ] Display song metadata
- [ ] Status management (downloaded, processing, etc.)

## Implementation Steps

1. **Explore existing structure** - Understand current design system
2. **Create Library component** - Main container
3. **Build search component** - With URL detection
4. **Build table view** - Song list in table format
5. **Build card view** - Song cards with thumbnails
6. **Implement view toggle** - Switch between table/card
7. **Add download integration** - Smart download detection
8. **Wire up data loading** - Connect to backend API
9. **Polish and test** - Ensure consistent design

## Status
- **Current**: Core implementation complete, ready for testing
- **Blockers**: None

## Completed Items

### Views
- [x] Table view with title, artists, status pills - `frontend/src/components/library/SongTable.tsx`
- [x] Card view with video thumbnail as background, title, artists, status pills - `frontend/src/components/library/SongCards.tsx`
- [x] View toggle between table and cards - `frontend/src/views/library/LibraryPage.tsx`

### Search Functionality
- [x] Search by title - Filters in LibraryPage.tsx
- [x] Search by artist names - Filters in LibraryPage.tsx
- [x] Search by YT URL - Filters check metadata.youtube_url
- [x] Search by YT Music URL - Same URL detection
- [x] URL detection - `frontend/src/components/library/SearchBar.tsx`
- [x] Show download button when search is URL - SearchBar component

### Design
- [x] Glassmorphic design (like landing page nav) - Using `.nav-glass` class
- [x] 60-30-10 color palette - dark (60%), gray (30%), accent (10%)
- [x] Consistent fontface - display (Space Grotesk), sans (Inter), mono (JetBrains Mono)
- [x] Consistent spacing - Standard Tailwind spacing (gap-6, px-6, py-4)
- [x] Responsive layout - Grid system for cards, responsive table

### Data Integration
- [x] Load songs from downloads directory - GET /library/songs
- [x] Display song metadata - Title, artist, duration, date
- [x] Status management - Status pills for audio, converted, analysis, stems, lyrics

### Components Created
1. `frontend/src/types/song.ts` - TypeScript types for Song and ViewMode
2. `frontend/src/components/library/StatusPill.tsx` - Status indicator pills
3. `frontend/src/components/library/SearchBar.tsx` - Smart search with URL detection
4. `frontend/src/components/library/SongTable.tsx` - Table view component
5. `frontend/src/components/library/SongCards.tsx` - Card grid view component
6. `frontend/src/views/library/LibraryPage.tsx` - Main library page
7. `frontend/src/views/library/index.ts` - Export barrel

### Integration
- [x] Wired up `/library` route in App.tsx
- [x] API integration for loading songs
- [x] Download integration via POST /download

## Notes

The library UI is complete with all requested features:
- Glassmorphic design matching the landing page
- Smart search that detects YouTube URLs and shows download button
- Toggle between table and card views
- Card view shows thumbnails from metadata
- Status pills show what processing has been done
- Empty state messaging for no results
- Loading states

Ready for user review and testing.
