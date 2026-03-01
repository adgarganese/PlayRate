# Court Search Implementation

## Summary

Added search functionality to the Courts list page that allows users to search by court name or address with debounced input and proper error handling.

## Files Changed

### 1. `lib/courts.ts`
- **Modified**: `fetchCourts()` function
- **Changes**:
  - Added optional `searchQuery` parameter
  - When `searchQuery` is provided, filters using `.or()` with `ilike` operators on both `name` and `address` fields
  - Orders search results by `name` ASC for better matching, default list remains `created_at` DESC
  - Maintains limit of 50 results for performance
  - Case-insensitive partial matching via `ilike` with `%query%` pattern

### 2. `app/courts/index.tsx`
- **Modified**: Main Courts list screen
- **Changes**:
  - Added search input state (`searchInput`, `searchQuery`)
  - Implemented 350ms debounce for search input
  - Added search bar UI component with:
    - Search icon on left
    - Clear (X) button on right (visible when text exists)
    - Placeholder: "Search by court name or address…"
    - Theme-aware styling (uses theme tokens, no hardcoded colors)
  - Updated `loadCourts()` to pass `searchQuery` to `fetchCourts()`
  - Search results shown in single section (no split by followed status)
  - Added "Searching..." indicator during debounce/query
  - Updated empty states:
    - Shows "No courts found" with "Try adjusting your search terms" when searching
    - Shows default "No courts yet" when not searching
  - Handles missing/null address fields gracefully (search still works)

### 3. `components/ui/icon-symbol.tsx`
- **Modified**: Icon mapping
- **Changes**:
  - Added `'magnifyingglass': 'search'` for search icon
  - Added `'xmark.circle.fill': 'cancel'` for clear button icon

## Features Implemented

✅ **Search Bar UI**
- Positioned at top of screen, below header
- Search icon on left, clear button on right
- Theme-aware (light/dark mode support)
- Clear button only visible when text exists

✅ **Debouncing**
- 350ms delay between input and query
- Prevents excessive API calls while typing
- Shows "Searching..." indicator during debounce

✅ **Search Functionality**
- Searches both `courts.name` and `courts.address` fields
- Case-insensitive partial matching
- Results ordered by name (ASC) for search, created_at (DESC) for default
- Limit of 50 results

✅ **Edge Cases**
- Empty query shows default court list
- Empty search results show helpful message
- Handles null/missing address fields
- Normalizes query (trim whitespace, handle extra spaces)
- Clear button resets search immediately
- Loading states for initial load vs search

✅ **User Experience**
- Smooth transitions between search and default view
- Search results shown in unified list (not split by followed status)
- Maintains refresh functionality during search
- Proper empty states for both scenarios

## Testing Guide

### 1. Basic Search
**Steps:**
1. Navigate to Courts tab
2. Type a court name in search bar (e.g., "Park")
3. Wait ~350ms
4. Verify results filter to matching courts

**Expected:**
- Results appear after brief delay
- Only courts matching name OR address are shown
- Search icon visible on left, clear (X) on right when text exists

### 2. Address Search
**Steps:**
1. Clear search
2. Type an address fragment (e.g., "Main Street")
3. Wait for results

**Expected:**
- Courts with matching addresses appear
- Case-insensitive matching works

### 3. Clear Search
**Steps:**
1. Type a search query
2. Click the X (clear) button
3. Verify default list returns

**Expected:**
- Search input clears immediately
- Default court list (with sections) returns
- No loading spinner (results are cached)

### 4. Empty Search Results
**Steps:**
1. Type a query that matches no courts (e.g., "zzzzzzzzz")
2. Wait for search to complete

**Expected:**
- Shows "No courts found" message
- Shows "Try adjusting your search terms" subtext
- No error, graceful empty state

### 5. Debouncing
**Steps:**
1. Rapidly type in search bar (e.g., "p", "pa", "par", "park")
2. Watch the search indicator

**Expected:**
- "Searching..." appears briefly
- Query only executes after 350ms of no typing
- No multiple queries for each keystroke

### 6. Slow Network / Loading States
**Steps:**
1. Enable network throttling (DevTools)
2. Perform a search
3. Observe loading behavior

**Expected:**
- "Searching..." indicator shows during query
- No full-screen loading (only inline indicator)
- Results appear when query completes

### 7. Mixed Case / Special Characters
**Steps:**
1. Search for "PARK" (all caps)
2. Search for "park" (lowercase)
3. Search with extra spaces (e.g., "  park  ")

**Expected:**
- Case-insensitive matching works
- Extra spaces are trimmed automatically
- Results are consistent

### 8. Missing Address Fields
**Steps:**
1. Ensure some courts have null/empty addresses
2. Search for a court name that has null address
3. Verify it still appears in results

**Expected:**
- Courts with null addresses still searchable by name
- No errors or crashes
- Search handles missing fields gracefully

### 9. Search + Refresh
**Steps:**
1. Perform a search
2. Pull down to refresh

**Expected:**
- Refresh works normally
- Search results refresh with latest data
- Search query persists after refresh

### 10. Long Search Query
**Steps:**
1. Type a very long search query (50+ characters)
2. Verify search still works

**Expected:**
- Search executes normally
- No performance issues
- Results still relevant (if any match)

## Technical Details

### Query Structure
```typescript
.or(`name.ilike.%${normalizedQuery}%,address.ilike.%${normalizedQuery}%`)
```
- Uses Supabase's `.or()` method to search multiple fields
- `ilike` provides case-insensitive partial matching
- `%query%` pattern matches anywhere in the field

### Debounce Implementation
- Uses `useRef` to store timer reference
- Clears timer on input change or unmount
- Immediately clears search if input becomes empty
- Sets `searching` state for better UX feedback

### State Management
- `searchInput`: Raw input from user (not debounced)
- `searchQuery`: Actual query sent to API (debounced)
- `searching`: Boolean indicating active search operation

### Performance Considerations
- Results limited to 50 for performance
- Debounce reduces API calls
- Query uses indexed fields (name, address) for fast lookups
- No unnecessary re-renders during debounce period

## Future Enhancements (Optional)

- Add search history
- Highlight matching text in results
- Add filters (sport, location radius) combined with search
- Add keyboard shortcuts (Cmd+K / Ctrl+K)
- Save search preferences
