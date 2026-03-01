# Check-In System & Leaderboard Testing Checklist

## ✅ Implementation Complete

### Features Implemented:
1. ✅ `check_ins` table with indexes
2. ✅ RPC function `check_in()` with anti-spam enforcement
3. ✅ RLS policies for security
4. ✅ Check-in UI on Court Details screen
5. ✅ Leaderboard queries and UI
6. ✅ King of the Hill (crown icon for #1)

---

## 🗄️ Database Setup

### Step 1: Run Migration
1. [ ] Open Supabase SQL Editor
2. [ ] Copy contents of `check-in-migration.sql`
3. [ ] Run the migration
4. [ ] Verify success (no errors)

### Step 2: Verify Tables & Functions
1. [ ] Check `check_ins` table exists:
   ```sql
   SELECT * FROM public.check_ins LIMIT 1;
   ```
2. [ ] Verify indexes exist:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'check_ins';
   ```
3. [ ] Verify RPC function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'check_in';
   ```
4. [ ] Verify leaderboard function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_court_leaderboard';
   ```
5. [ ] Verify leaderboard view exists:
   ```sql
   SELECT * FROM public.court_leaderboard LIMIT 1;
   ```

---

## 🧪 Feature A: Check-In Testing

### A1. Basic Check-In
**Prerequisites**: Signed in user, existing court

1. [ ] Navigate to Court Details screen
2. [ ] Verify "Check In" button appears (if not checked in today)
3. [ ] Tap "Check In" button
4. [ ] Verify:
   - [ ] Button shows loading state
   - [ ] Success alert appears: "Checked in!"
   - [ ] UI updates to show "Checked in today" with timestamp
   - [ ] Check-in count updates (if > 0)
   - [ ] No errors in console

### A2. Anti-Spam Enforcement
**Prerequisites**: User already checked in today

1. [ ] Navigate to Court Details screen
2. [ ] Verify status shows "Checked in today" with timestamp
3. [ ] Verify "Check In" button is NOT visible
4. [ ] Try to check in again (if button still visible due to bug):
   - [ ] Should see alert: "You already checked in today."
   - [ ] No new check-in created
   - [ ] Verify only one check-in exists in database for today:
     ```sql
     SELECT COUNT(*) FROM check_ins 
     WHERE user_id = '<your_user_id>' 
     AND court_id = '<court_id>'
     AND created_at >= date_trunc('day', NOW());
     ```

### A3. Check-In After 24 Hours / New Day
**Prerequisites**: User checked in yesterday (or before midnight UTC today)

1. [ ] Navigate to Court Details screen
2. [ ] Verify "Check In" button appears (if previous check-in was before today)
3. [ ] Tap "Check In"
4. [ ] Verify new check-in is created
5. [ ] Verify timestamp updates to current time

### A4. Multiple Users Check-In
**Prerequisites**: 2+ signed-in users, same court

1. [ ] User A: Check in at court
2. [ ] User B: Check in at same court
3. [ ] Verify:
   - [ ] Each user can check in independently
   - [ ] Check-in count shows correct number (2)
   - [ ] Both check-ins appear in database with different `user_id`

### A5. Unauthenticated User
**Prerequisites**: Not signed in

1. [ ] Navigate to Court Details screen (as guest)
2. [ ] Verify:
   - [ ] "Check In" button is NOT visible
   - [ ] Message appears: "Sign in to check in at this court"
3. [ ] Sign in
4. [ ] Verify "Check In" button appears

### A6. Check-In Count Display
**Prerequisites**: Multiple users have checked in today

1. [ ] Navigate to Court Details screen
2. [ ] Verify check-in count displays:
   - [ ] Format: "X people have checked in today" (or "1 person has checked in today" for singular)
   - [ ] Count matches database:
     ```sql
     SELECT COUNT(*) FROM check_ins 
     WHERE court_id = '<court_id>'
     AND created_at >= date_trunc('day', NOW());
     ```

### A7. Error Handling
1. [ ] Test with invalid court ID (should not happen in normal flow)
2. [ ] Test network error (turn off internet):
   - [ ] Verify error alert appears
   - [ ] Verify UI doesn't break
3. [ ] Test when RPC function fails:
   - [ ] Verify error message is displayed
   - [ ] Verify user is informed

---

## 🏆 Feature B: Leaderboard Testing

### B1. Leaderboard Display (Top 3)
**Prerequisites**: Court has at least 3 users with check-ins

1. [ ] Navigate to Court Details screen
2. [ ] Verify "Leaderboard" section appears
3. [ ] Verify top 3 users displayed:
   - [ ] Rank (#1, #2, #3)
   - [ ] User name (display_name or username)
   - [ ] Check-in count
   - [ ] Crown icon (👑) on #1 only
4. [ ] Verify styling:
   - [ ] #1 has crown icon with gold color
   - [ ] #1 rank text is primary color
   - [ ] Others have normal text color

### B2. Full Leaderboard Modal
**Prerequisites**: Court has more than 3 users with check-ins

1. [ ] Navigate to Court Details screen
2. [ ] Tap "View Full Leaderboard" button
3. [ ] Verify modal appears from bottom
4. [ ] Verify:
   - [ ] Modal shows all users (up to 10)
   - [ ] #1 has crown icon
   - [ ] All ranks displayed (#1, #2, #3, etc.)
   - [ ] Check-in counts correct
   - [ ] Can scroll if more than 10 users
5. [ ] Close modal (tap X or outside)
6. [ ] Verify modal closes smoothly

### B3. Empty Leaderboard
**Prerequisites**: Court has no check-ins

1. [ ] Navigate to Court Details screen (new court with no check-ins)
2. [ ] Verify:
   - [ ] Leaderboard section does NOT appear
   - [ ] No errors in console

### B4. Single User Leaderboard
**Prerequisites**: Only 1 user has checked in

1. [ ] Navigate to Court Details screen
2. [ ] Verify:
   - [ ] Leaderboard section appears
   - [ ] Shows only 1 user (rank #1 with crown)
   - [ ] No "View Full Leaderboard" button (since ≤ 3 users)

### B5. Leaderboard Ranking Logic
**Prerequisites**: Multiple users with different check-in counts

1. [ ] Verify ranking:
   - [ ] Users sorted by total check-ins (descending)
   - [ ] Ties broken by most recent check-in (later wins)
   - [ ] Rank numbers are sequential (1, 2, 3, etc.)

2. [ ] Test tie-breaking:
   - [ ] User A: 5 check-ins, last one 2 days ago
   - [ ] User B: 5 check-ins, last one 1 day ago
   - [ ] Verify User B ranked #1, User A ranked #2

### B6. Leaderboard Updates
1. [ ] User A checks in (has 3 total check-ins)
2. [ ] User B checks in (has 2 total check-ins)
3. [ ] Refresh Court Details screen
4. [ ] Verify leaderboard updates:
   - [ ] User A appears at top (now 4 check-ins)
   - [ ] User B appears below (now 3 check-ins)
   - [ ] Ranks recalculated correctly

### B7. User Profile Display
1. [ ] Verify leaderboard shows:
   - [ ] Display name if available
   - [ ] Falls back to username if no display name
   - [ ] Falls back to "Anonymous" if neither exists
2. [ ] Test with users who have:
   - [ ] Only name set
   - [ ] Only username set
   - [ ] Both name and username set
   - [ ] Neither set (should show "Anonymous")

---

## 🎨 UI/UX Testing

### Light Mode
1. [ ] Check-in button visible and readable
2. [ ] Check-in status text readable
3. [ ] Leaderboard entries readable
4. [ ] Crown icon visible
5. [ ] Modal readable and styled correctly

### Dark Mode
1. [ ] Check-in button visible and readable
2. [ ] Check-in status text readable (white)
3. [ ] Leaderboard entries readable
4. [ ] Crown icon visible
5. [ ] Modal readable and styled correctly

### Responsive Layout
1. [ ] Check-in section fits on screen
2. [ ] Leaderboard cards fit on screen
3. [ ] Modal fits on screen (80% max height)
4. [ ] Text doesn't overflow
5. [ ] Buttons are tappable

### Loading States
1. [ ] Check-in button shows loading spinner while checking in
2. [ ] Leaderboard shows loading state (if applicable)
3. [ ] No flickering or layout shifts

---

## 🔒 Security & RLS Testing

### RLS Policies
1. [ ] Unauthenticated users cannot insert check-ins directly:
   ```sql
   -- This should fail if RLS is working
   INSERT INTO check_ins (court_id, user_id) 
   VALUES ('<court_id>', '00000000-0000-0000-0000-000000000000');
   ```

2. [ ] Users can only delete their own check-ins:
   ```sql
   -- User A cannot delete User B's check-in
   ```

3. [ ] All users can read all check-ins:
   ```sql
   SELECT * FROM check_ins; -- Should work for all authenticated users
   ```

### RPC Function Security
1. [ ] RPC function uses `auth.uid()` (not accepting user_id parameter)
2. [ ] RPC function enforces anti-spam
3. [ ] RPC function validates court exists
4. [ ] RPC function returns proper error messages

---

## ⚡ Performance Testing

### Database Performance
1. [ ] Indexes are being used (check query plans)
2. [ ] Check-in query completes in < 200ms
3. [ ] Leaderboard query completes in < 500ms (even with many check-ins)
4. [ ] No N+1 query problems

### UI Performance
1. [ ] Court Details screen loads in < 2s
2. [ ] Check-in response time < 1s
3. [ ] Leaderboard loads in < 1s
4. [ ] Modal opens smoothly (< 300ms animation)
5. [ ] No UI lag when scrolling leaderboard

---

## 🐛 Edge Cases & Error Handling

### Edge Case 1: Midnight UTC Transition
1. [ ] User checks in at 23:59 UTC
2. [ ] User tries to check in at 00:01 UTC (new day)
3. [ ] Verify second check-in is allowed (new calendar day)

### Edge Case 2: Database Connection Issues
1. [ ] Turn off internet
2. [ ] Try to check in
3. [ ] Verify error message appears
4. [ ] Verify UI doesn't break

### Edge Case 3: Court Deleted
1. [ ] User has checked in at court
2. [ ] Admin deletes court
3. [ ] Verify check-ins cascade delete
4. [ ] Verify no errors when viewing leaderboard

### Edge Case 4: User Deleted
1. [ ] User has checked in at court
2. [ ] User account deleted
3. [ ] Verify check-ins cascade delete
4. [ ] Verify leaderboard updates correctly

### Edge Case 5: Multiple Check-Ins Same Second
1. [ ] Two users check in at exact same time
2. [ ] Verify both check-ins created
3. [ ] Verify ranking handles ties correctly

---

## 📱 Device Testing

### iOS
- [ ] iPhone (various sizes)
- [ ] iPad (if supported)
- [ ] iOS 15+
- [ ] Dark mode
- [ ] Light mode

### Android
- [ ] Various Android devices
- [ ] Android 10+
- [ ] Dark mode
- [ ] Light mode

---

## ✅ Success Criteria

All tests should pass:
- ✅ Check-in works for authenticated users
- ✅ Anti-spam prevents multiple check-ins per day
- ✅ Leaderboard displays top users correctly
- ✅ Crown icon shows on #1
- ✅ Full leaderboard modal works
- ✅ Light/dark mode parity
- ✅ No console errors
- ✅ RLS policies enforced
- ✅ Performance acceptable
- ✅ Error handling graceful

---

## 📝 Test Results Template

```
Date: __________
Tester: __________
Device: __________
OS: __________

Database Setup:
- Migration: ✅ / ❌
- Tables: ✅ / ❌
- Functions: ✅ / ❌

Check-In (Feature A):
- A1. Basic Check-In: ✅ / ❌
- A2. Anti-Spam: ✅ / ❌
- A3. After 24 Hours: ✅ / ❌
- A4. Multiple Users: ✅ / ❌
- A5. Unauthenticated: ✅ / ❌
- A6. Count Display: ✅ / ❌
- A7. Error Handling: ✅ / ❌

Leaderboard (Feature B):
- B1. Top 3 Display: ✅ / ❌
- B2. Full Modal: ✅ / ❌
- B3. Empty: ✅ / ❌
- B4. Single User: ✅ / ❌
- B5. Ranking Logic: ✅ / ❌
- B6. Updates: ✅ / ❌
- B7. Profile Display: ✅ / ❌

UI/UX:
- Light Mode: ✅ / ❌
- Dark Mode: ✅ / ❌
- Responsive: ✅ / ❌
- Loading States: ✅ / ❌

Security:
- RLS Policies: ✅ / ❌
- RPC Security: ✅ / ❌

Performance:
- Database: ✅ / ❌
- UI: ✅ / ❌

Edge Cases:
- All: ✅ / ❌

Issues Found:
1. 
2. 
3. 

Notes:
```

---

## 🚀 Next Steps After Testing

1. If all tests pass, mark as complete ✅
2. If issues found, create bug reports with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs
   - Device/OS info
3. Update documentation if needed
4. Consider adding automated tests for critical paths
