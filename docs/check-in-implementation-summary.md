# Check-In System & Leaderboard Implementation Summary

## 📋 Overview

Implemented a complete athlete "Check-In" system with per-court leaderboard ("King of the Hill") functionality. Users can check in at courts/fields once per day, and a leaderboard tracks the top users for each court.

---

## 🗄️ Database Changes

### New Table: `check_ins`
- **Purpose**: Stores user check-ins at courts
- **Columns**:
  - `id` (UUID, PK)
  - `court_id` (UUID, FK → courts)
  - `user_id` (UUID, FK → auth.users)
  - `created_at` (TIMESTAMPTZ, default NOW())
- **Indexes**:
  - `idx_check_ins_court_id_created_at` - For querying recent check-ins
  - `idx_check_ins_court_id_user_id_created_at` - For anti-spam checks
  - `idx_check_ins_user_id` - For user-specific queries

### RPC Function: `check_in(court_id_param UUID)`
- **Purpose**: Handles check-in logic with anti-spam enforcement
- **Anti-Spam Rules**: 1 check-in per user per court per calendar day (UTC)
- **Returns**: JSON with `success`, `message`, and optional `last_check_in` or `check_in_id`

### View: `court_leaderboard`
- **Purpose**: Aggregated leaderboard view
- **Columns**: `court_id`, `user_id`, `total_check_ins`, `last_check_in`, `rank`
- **Ranking**: Sorted by total check-ins (desc), then by most recent check-in (desc)

### RPC Function: `get_court_leaderboard(court_id_param UUID, limit_count INT)`
- **Purpose**: Returns top N users for a court with profile information
- **Returns**: Table with `user_id`, `total_check_ins`, `rank`, `last_check_in`, `display_name`, `username`

### RLS Policies
- **SELECT**: All authenticated users can read all check-ins
- **INSERT**: Prevented (must use RPC function)
- **DELETE**: Users can only delete their own check-ins

---

## 📁 Files Changed

### SQL Migration
- **`check-in-migration.sql`** (NEW)
  - Creates `check_ins` table
  - Creates indexes
  - Sets up RLS policies
  - Creates RPC functions
  - Creates leaderboard view

### TypeScript/React Files

#### `lib/courts.ts`
- **Added Functions**:
  - `checkInCourt(courtId: string)`: Calls RPC function to check in
  - `getUserCheckIn(courtId: string, userId: string)`: Gets user's check-in for today
  - `getTodayCheckInCount(courtId: string)`: Gets count of check-ins today
  - `getCourtLeaderboard(courtId: string, limit: number)`: Gets top N users
- **Added Types**:
  - `CheckInResult`: Result from check-in RPC
  - `LeaderboardEntry`: Leaderboard entry with user info

#### `app/courts/[courtId].tsx`
- **Added State**:
  - `userCheckIn`: User's check-in timestamp (if exists today)
  - `todayCheckInCount`: Total check-ins today
  - `checkingIn`: Loading state for check-in
  - `loadingCheckIn`: Loading state for fetching check-in status
  - `leaderboard`: Array of leaderboard entries
  - `loadingLeaderboard`: Loading state for leaderboard
  - `showLeaderboardModal`: Modal visibility state
- **Added Functions**:
  - `loadCheckInStatus()`: Loads user's check-in status
  - `loadTodayCheckInCount()`: Loads today's check-in count
  - `loadLeaderboard()`: Loads top 10 users
  - `handleCheckIn()`: Handles check-in button press
  - `formatCheckInTime()`: Formats check-in timestamp for display
- **Added UI Sections**:
  - **Check-In Section**: Button or status display
  - **Leaderboard Section**: Top 3 with crown for #1
  - **Leaderboard Modal**: Full leaderboard view

---

## 🎨 UI Components

### Check-In Section
- **Location**: Court Details screen, after "Notes & Rules" section
- **Components**:
  - "Check In" button (if not checked in today)
  - "Checked in today" status with timestamp (if checked in)
  - Check-in count: "X people have checked in today"
- **States**:
  - Unauthenticated: "Sign in to check in at this court"
  - Authenticated, not checked in: "Check In" button
  - Authenticated, checked in: Status with timestamp

### Leaderboard Section
- **Location**: Court Details screen, after "Check-In" section
- **Components**:
  - Top 3 users displayed in cards
  - Crown icon (👑) for #1 user
  - Rank, name, and check-in count
  - "View Full Leaderboard" button (if > 3 users)
- **Styling**:
  - #1 has gold crown icon
  - #1 rank text is primary color
  - Others have normal styling

### Leaderboard Modal
- **Trigger**: "View Full Leaderboard" button
- **Content**: Top 10 users (scrollable if needed)
- **Features**:
  - Crown icon for #1
  - Rank, name, check-in count for each
  - Close button (X icon)
  - Slide-up animation

---

## 🔒 Security Features

1. **Anti-Spam Enforcement**:
   - Enforced at database level via RPC function
   - 1 check-in per user per court per calendar day (UTC)
   - Cannot be bypassed by direct INSERT

2. **RLS Policies**:
   - SELECT: Open to all authenticated users
   - INSERT: Prevented (must use RPC)
   - DELETE: Users can only delete their own check-ins

3. **Authentication Required**:
   - Check-in requires authenticated user
   - RPC function validates `auth.uid()`
   - UI shows sign-in prompt for guests

---

## 📊 Data Flow

### Check-In Flow
1. User taps "Check In" button
2. Client calls `checkInCourt(courtId)`
3. Function calls Supabase RPC `check_in(court_id_param)`
4. RPC function:
   - Validates user is authenticated
   - Checks if user already checked in today
   - If allowed, inserts new check-in
   - Returns success/error message
5. Client updates UI optimistically
6. Client reloads check-in status and leaderboard

### Leaderboard Flow
1. Court Details screen loads
2. Client calls `getCourtLeaderboard(courtId, 10)`
3. Function calls Supabase RPC `get_court_leaderboard(court_id_param, limit_count)`
4. RPC function:
   - Queries `court_leaderboard` view
   - Joins with `profiles` for user info
   - Returns top N users sorted by rank
5. Client displays top 3 in section
6. Full leaderboard shown in modal

---

## 🎯 Key Features

### ✅ Implemented
- ✅ Check-in button and status display
- ✅ Anti-spam enforcement (1 per day per court)
- ✅ Today's check-in count display
- ✅ Leaderboard (top 3 + full modal)
- ✅ King of the Hill (crown icon for #1)
- ✅ Light/dark mode support
- ✅ Error handling and loading states
- ✅ RLS policies for security
- ✅ Optimistic UI updates

### 🚫 Not Implemented (Future)
- Monthly leaderboard (all-time only for now)
- "Court Kings" badges on user profiles
- Push notifications for check-ins
- Check-in streaks/achievements

---

## 🧪 Testing

See `check-in-testing-checklist.md` for comprehensive testing guide.

**Quick Test Steps**:
1. Run SQL migration in Supabase
2. Navigate to Court Details screen
3. Tap "Check In" button
4. Verify check-in status appears
5. Try to check in again (should be blocked)
6. Verify leaderboard displays top users
7. Open full leaderboard modal

---

## 📝 SQL Migration Instructions

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `check-in-migration.sql`
3. Paste and run
4. Verify no errors
5. Test RPC function:
   ```sql
   SELECT check_in('<court_id>');
   ```

---

## 🔧 Troubleshooting

### Check-in Not Working
- Verify RPC function exists: `SELECT proname FROM pg_proc WHERE proname = 'check_in';`
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'check_ins';`
- Verify user is authenticated: Check `auth.uid()` returns user ID

### Leaderboard Not Showing
- Verify view exists: `SELECT * FROM court_leaderboard LIMIT 1;`
- Check if court has check-ins: `SELECT COUNT(*) FROM check_ins WHERE court_id = '<court_id>';`
- Verify function exists: `SELECT proname FROM pg_proc WHERE proname = 'get_court_leaderboard';`

### Anti-Spam Not Working
- Check RPC function logic (should use calendar day, not 24 hours)
- Verify INSERT policy prevents direct inserts
- Check timezone settings (uses UTC)

---

## 📚 Additional Documentation

- **Testing Checklist**: `docs/check-in-testing-checklist.md`
- **SQL Migration**: `check-in-migration.sql`
- **Type Definitions**: See `lib/courts.ts` for `CheckInResult` and `LeaderboardEntry`

---

## ✅ Completion Checklist

- [x] Database migration created
- [x] RPC function for check-in
- [x] Anti-spam enforcement
- [x] RLS policies
- [x] Check-in UI implemented
- [x] Leaderboard queries
- [x] Leaderboard UI implemented
- [x] King of the Hill (crown icon)
- [x] Error handling
- [x] Light/dark mode support
- [x] Testing checklist created

**Status**: ✅ **COMPLETE** - Ready for testing!
