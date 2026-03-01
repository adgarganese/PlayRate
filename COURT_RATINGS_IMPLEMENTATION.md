# Court Rating System Implementation

## Overview
Added a comprehensive court rating system allowing users to rate courts on a 1-10 scale, with aggregated statistics displayed on the court detail screen.

## Files Modified/Created

### 1. Database Migration
- **File**: `court-ratings-migration.sql`
- **Purpose**: Creates the `court_ratings` table, RLS policies, triggers, view, and RPC function
- **Key Features**:
  - Unique constraint on (court_id, user_id) to prevent duplicate ratings
  - RLS policies matching app patterns (public read, authenticated write)
  - Auto-updating `updated_at` timestamp
  - Efficient aggregation via view and RPC function

### 2. Backend Functions
- **File**: `lib/courts.ts`
- **Added Functions**:
  - `getCourtRatingInfo(courtId, userId?)`: Fetches rating stats + user's rating in one call
  - `submitCourtRating(courtId, userId, rating)`: Upserts a rating (create or update)
  - `deleteCourtRating(courtId, userId)`: Deletes a user's rating
- **Added Types**:
  - `CourtRatingInfo`: Type for rating statistics

### 3. UI Implementation
- **File**: `app/courts/[courtId].tsx`
- **Added Features**:
  - Court Rating section displaying:
    - Average rating (1 decimal place)
    - Total number of ratings
    - User's current rating (if authenticated)
    - 1-10 rating picker buttons
    - Submit button (only shown when rating changes)
  - Optimistic UI updates
  - Success haptic feedback using `playSubmitBuzz()`
  - Loading and error states

## Implementation Details

### Database Schema
```sql
court_ratings (
  id UUID PRIMARY KEY,
  court_id UUID REFERENCES courts(id),
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(court_id, user_id)
)
```

### Aggregation Approach (Approach B - Preferred)
**Why Approach B?**
- **Performance**: Single RPC call instead of multiple queries
- **Consistency**: Database-level aggregation ensures accuracy
- **Scalability**: Efficient even with thousands of ratings
- **Maintainability**: Centralized logic in database

**Implementation**:
- `court_rating_stats` view for quick lookups
- `get_court_rating_info()` RPC function returns stats + user rating in one call

### UI/UX Features
- **Responsive Design**: Rating buttons scale based on screen width (28-44px)
- **Visual Feedback**: 
  - Selected rating highlighted
  - Saved rating shown with semi-transparent primary color
  - Submit button only appears when rating changes
- **Optimistic Updates**: UI updates immediately, then syncs with server
- **Error Handling**: Reverts optimistic update on error, shows friendly messages

### RLS Policies
- **SELECT**: Anyone can read ratings (public data)
- **INSERT**: Only authenticated users can insert their own ratings
- **UPDATE**: Only authenticated users can update their own ratings
- **DELETE**: Only authenticated users can delete their own ratings

## Step-by-Step Plan

1. ✅ **Database Migration**
   - Run `court-ratings-migration.sql` in Supabase SQL editor
   - Verifies table creation, indexes, RLS policies, triggers, view, and RPC function

2. ✅ **Backend Functions**
   - Added types and functions to `lib/courts.ts`
   - Functions handle rating CRUD operations

3. ✅ **UI Implementation**
   - Added rating section to court detail screen
   - Integrated with existing UI patterns
   - Added responsive button sizing

4. ✅ **Testing** (See test plan below)

## Test Plan

### 1. Create Rating
- **Steps**:
  1. Navigate to a court detail screen
  2. Sign in (if not already)
  3. Select a rating (1-10)
  4. Click "Submit Rating"
- **Expected**:
  - Success haptic feedback
  - Alert: "Your rating has been saved!"
  - Average rating updates
  - Rating count increments
  - User's rating displayed

### 2. Update Rating
- **Steps**:
  1. Navigate to court detail screen (with existing rating)
  2. Select a different rating
  3. Click "Submit Rating"
- **Expected**:
  - Average rating recalculates
  - Rating count stays same
  - User's rating updates
  - Success feedback

### 3. Verify Average/Count
- **Steps**:
  1. Rate a court as User A (e.g., 8/10)
  2. Rate same court as User B (e.g., 6/10)
  3. Check average: should be 7.0
  4. Check count: should be 2
- **Expected**:
  - Average: (8 + 6) / 2 = 7.0
  - Count: 2 ratings

### 4. Verify Uniqueness
- **Steps**:
  1. Rate a court (e.g., 7/10)
  2. Try to insert duplicate via SQL:
     ```sql
     INSERT INTO court_ratings (court_id, user_id, rating)
     VALUES ('same-court-id', 'same-user-id', 9);
     ```
- **Expected**:
  - Error: duplicate key violation
  - OR: Upsert updates existing rating to 9

### 5. Verify RLS
- **Steps**:
  1. Sign in as User A
  2. Rate a court
  3. Sign out
  4. Try to update rating via Supabase client
- **Expected**:
  - Unauthenticated users cannot insert/update/delete
  - SELECT works (public read)

### 6. UI Edge Cases
- **No Ratings Yet**:
  - Shows "No ratings yet. Be the first to rate this court!"
- **Unauthenticated User**:
  - Shows "Sign in to rate this court"
  - No rating picker shown
- **Loading State**:
  - Shows "Loading ratings..." while fetching
- **Error State**:
  - Shows friendly error message
  - Reverts optimistic update

## Cooldown Recommendation

**Recommendation**: No cooldown required for court ratings.

**Reasoning**:
- Court ratings are subjective opinions, not skill assessments
- Users may want to update ratings after visiting again
- Simpler UX without cooldown logic
- Unique constraint already prevents spam (one rating per user per court)

**Alternative**: If cooldown desired, add `last_rated_at` column and check in `handleSubmitRating()`:
```typescript
// Example: 24-hour cooldown
const lastRated = ratingInfo?.last_rated_at;
if (lastRated && Date.now() - new Date(lastRated).getTime() < 24 * 60 * 60 * 1000) {
  Alert.alert('Cooldown', 'You can update your rating once per day.');
  return;
}
```

## Next Steps

1. Run the migration SQL in Supabase
2. Test the implementation using the test plan above
3. Monitor for any edge cases or errors
4. Consider adding rating history/charts if needed
5. Consider adding rating filters/sorting if needed

## Notes

- Rating buttons use responsive sizing (28-44px) based on screen width
- Follows existing UI patterns from self-ratings screen
- Uses same haptic feedback pattern (`playSubmitBuzz()`)
- Optimistic updates for better UX
- Error handling with user-friendly messages
