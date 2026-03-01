# Testing Guide: Multi-Sport & Soccer Features

## ✅ Completed Implementation

### Task 1: Snapshot Stats Calculation ✅
- Stats (Shooting, Defense, Hustle) now calculate from actual ratings
- Sport-specific attribute mappings:
  - **Basketball**: 
    - Shooting = "Shooting" attribute (1-10 → 0-100)
    - Defense = Average of "Perimeter Defense" + "Post Defense" (1-10 → 0-100)
    - Hustle = "Athleticism" attribute (1-10 → 0-100)
  - **Soccer**:
    - Shooting = "Shooting / Finishing" attribute (1-10 → 0-100)
    - Defense = "Defending" attribute (1-10 → 0-100)
    - Hustle = Average of "Athleticism", "Speed / Acceleration", "Stamina / Work Rate" (1-10 → 0-100)

### Task 2: Ratings Filtering by Sport ✅
- Ratings count filtered by active sport
- Cosigns count filtered by active sport
- "Last played" date filtered by active sport
- All queries filter through `sport_attributes` table to ensure sport-specific data

---

## 🧪 End-to-End Testing Checklist

### Pre-Testing Setup

1. **Database Migrations**
   - [ ] Run `multi-sport-support-migration.sql` in Supabase
   - [ ] Run `seed-soccer.sql` in Supabase
   - [ ] Verify Soccer sport and 10 attributes exist:
     ```sql
     SELECT * FROM sports WHERE name = 'Soccer';
     SELECT name FROM sport_attributes WHERE sport_id = (SELECT id FROM sports WHERE name = 'Soccer');
     ```

2. **User Account**
   - [ ] Sign up or sign in with a test account
   - [ ] Verify profile exists

---

### Test Suite 1: Multi-Sport Support

#### 1.1 Home Snapshot Sport Selector

**Prerequisites**: User has 2+ sports in their profile

1. **Single Sport User**
   - [ ] Navigate to Home screen
   - [ ] If user has only 1 sport (Basketball), verify:
     - Sport name appears as a label (not a chip)
     - No dropdown/selector appears
     - Snapshot data loads correctly for that sport

2. **Multiple Sports User**
   - [ ] Add Soccer to "My Sports" if not already added
   - [ ] Navigate to Home screen
   - [ ] Verify:
     - Sport selector chip appears (shows active sport name + chevron down)
     - Chip is tappable
     - Tapping opens modal with sport list
   - [ ] In modal:
     - [ ] All user's sports are listed
     - [ ] Current active sport is highlighted (checkmark icon)
     - [ ] Selecting a different sport:
       - [ ] Modal closes
       - [ ] Snapshot card updates immediately (no app restart)
       - [ ] Stats recalculate for new sport
       - [ ] Ratings count updates for new sport
       - [ ] Play style updates for new sport (if set)

3. **Active Sport Persistence**
   - [ ] Switch active sport on Home screen
   - [ ] Navigate away and come back
   - [ ] Verify selected sport is still active
   - [ ] Restart app
   - [ ] Verify selected sport persists after restart

#### 1.2 Athlete Profile Sport Switcher

1. **View Another Athlete's Profile**
   - [ ] Navigate to an athlete who has multiple sports
   - [ ] Verify:
     - Horizontal scrollable chip/tab row appears at top
     - Shows all sports that athlete has (e.g., "Basketball | Soccer")
     - Current sport is highlighted (different color/style)
   - [ ] Tap a different sport chip
   - [ ] Verify:
     - Profile data updates (ratings, play style)
     - Ratings list updates to show ratings for selected sport
     - If athlete has no ratings for that sport, shows "No skill ratings yet for this sport"

2. **Athlete with Single Sport**
   - [ ] View an athlete with only 1 sport
   - [ ] Verify:
     - No sport switcher chips appear (or disabled state)
     - Profile displays correctly for that sport

3. **Athlete with No Sports**
   - [ ] View an athlete with no sports added
   - [ ] Verify:
     - Shows "No sports added yet" message
     - Profile still loads (if they have basic profile info)

---

### Test Suite 2: Soccer Implementation

#### 2.1 Soccer Setup

1. **Add Soccer to Profile**
   - [ ] Navigate to "My Sports" screen
   - [ ] Verify "Soccer" appears in the list
   - [ ] Tap "Soccer" to add it
   - [ ] Verify:
     - Soccer appears in "My Sports" list
     - Can remove it and add it back

2. **Soccer Attributes**
   - [ ] Navigate to "Self Ratings" screen
   - [ ] Select "Soccer" from sport dropdown
   - [ ] Verify:
     - 10 attributes appear in this exact order:
       1. Athleticism
       2. Speed / Acceleration
       3. Stamina / Work Rate
       4. Ball Control
       5. First Touch
       6. Dribbling
       7. Passing
       8. Vision
       9. Shooting / Finishing
       10. Defending
     - Can rate each attribute (1-10 scale)
     - Ratings save correctly
     - Ratings persist after navigating away and back

3. **Soccer Play Styles**
   - [ ] Navigate to "Profile" screen
   - [ ] Make sure Soccer is selected as active sport (or switch to it)
   - [ ] Edit play style
   - [ ] Verify Soccer play styles appear:
     - Striker / Finisher
     - Playmaker
     - Winger
     - Box-to-Box
     - Defensive Mid
     - Center Back
     - Fullback
     - Goalkeeper
   - [ ] Select a play style and save
   - [ ] Verify:
     - Play style saves correctly
     - Play style displays on Home Snapshot (when Soccer is active)
     - Play style displays on Profile screen (when Soccer is active)
     - Can switch to Basketball, verify different play styles appear
     - Can switch back to Soccer, verify Soccer play style persists

#### 2.2 Soccer Snapshot Stats

1. **Rate Soccer Attributes**
   - [ ] Add ratings for Soccer attributes:
     - Athleticism: 8
     - Speed / Acceleration: 7
     - Stamina / Work Rate: 9
     - Ball Control: 6
     - First Touch: 7
     - Dribbling: 6
     - Passing: 8
     - Vision: 7
     - Shooting / Finishing: 8
     - Defending: 5
   - [ ] Save ratings

2. **Verify Soccer Stats on Home Snapshot**
   - [ ] Make Soccer the active sport on Home screen
   - [ ] Verify stats calculate correctly:
     - **Shooting**: Should be 80 (from "Shooting / Finishing" = 8, × 10)
     - **Defense**: Should be 50 (from "Defending" = 5, × 10)
     - **Hustle**: Should be 80 (average of Athleticism=8, Speed/Accel=7, Stamina=9 = 8, × 10)
   - [ ] Stats display in stat bars correctly (0-100 scale)
   - [ ] Switch to Basketball
   - [ ] Verify stats update to Basketball calculations (if Basketball ratings exist)

#### 2.3 Basketball Stats (Sanity Check)

1. **Verify Basketball Stats Still Work**
   - [ ] Make Basketball the active sport
   - [ ] Add/verify Basketball ratings:
     - Shooting: 7
     - Perimeter Defense: 5
     - Post Defense: 6
     - Athleticism: 8
   - [ ] Verify stats calculate correctly:
     - **Shooting**: Should be 70 (from "Shooting" = 7, × 10)
     - **Defense**: Should be 55 (average of Perimeter Defense=5, Post Defense=6 = 5.5, × 10)
     - **Hustle**: Should be 80 (from "Athleticism" = 8, × 10)
   - [ ] Verify stats update correctly when switching between sports

---

### Test Suite 3: Edge Cases & Error Handling

#### 3.1 Missing Data

1. **No Ratings for Active Sport**
   - [ ] Switch to a sport with no ratings
   - [ ] Verify:
     - Stats show 0 (or handle gracefully)
     - Ratings count shows 0
     - "Last played" shows "Never"
     - No errors in console

2. **Missing Attributes**
   - [ ] If a required attribute is missing (e.g., only rated 1 of 2 defense attributes for Basketball):
     - [ ] Defense stat calculates from available attributes only
     - [ ] No errors thrown

3. **Active Sport Not Set**
   - [ ] If `active_sport_id` is null but user has sports:
     - [ ] App defaults to first sport
     - [ ] Sets `active_sport_id` automatically
     - [ ] No errors in console

#### 3.2 Backwards Compatibility

1. **Migration Not Run**
   - [ ] If `active_sport_id` column doesn't exist:
     - [ ] App handles gracefully (falls back to legacy behavior)
     - [ ] No crashes or errors
     - [ ] Functionality still works (maybe defaults to first sport)

2. **Legacy Play Style**
   - [ ] If `sport_profiles` table doesn't exist:
     - [ ] Falls back to `profiles.play_style`
     - [ ] Still displays correctly

3. **Old Users Without Sports**
   - [ ] Existing users who haven't added any sports:
     - [ ] Can still use the app
     - [ ] No errors when loading Home Snapshot
     - [ ] Can add sports successfully

---

### Test Suite 4: Light/Dark Mode Parity

#### 4.1 Home Snapshot
- [ ] Light mode: All text readable, sport chip visible
- [ ] Dark mode: All text readable, sport chip visible
- [ ] Sport selector modal: Readable in both modes
- [ ] Stats bars: Visible in both modes

#### 4.2 Profile Screen
- [ ] Light mode: Sport switcher chips visible and readable
- [ ] Dark mode: Sport switcher chips visible and readable
- [ ] Play style dropdown: Works in both modes

#### 4.3 Self Ratings Screen
- [ ] Light mode: Sport dropdown visible
- [ ] Dark mode: Sport dropdown visible
- [ ] Attribute list: Readable in both modes

---

### Test Suite 5: Performance & Data Consistency

#### 5.1 Sport Switching Performance
- [ ] Switching sports on Home Snapshot: Updates within 1-2 seconds
- [ ] Switching sports on athlete profile: Updates within 1-2 seconds
- [ ] No unnecessary API calls (check Network tab)
- [ ] No memory leaks (test by switching 10+ times)

#### 5.2 Data Consistency
- [ ] Ratings count matches actual number of ratings for active sport
- [ ] Cosigns count matches actual number of cosigns for active sport
- [ ] Last played date matches most recent rating update for active sport
- [ ] Stats match calculated values from ratings

---

## 🐛 Known Issues to Watch For

1. **Cosigns Query**: If `to_user_id` column exists in database instead of `to_profile_id`, the cosigns count might fail. Check which column name is actually used.

2. **Supabase Join Performance**: The nested join for filtering ratings by sport might be slow if there are many ratings. Monitor performance.

3. **Attribute Name Matching**: If attribute names in database don't exactly match the definitions (e.g., "Shooting / Finishing" vs "Shooting/Finishing"), stats might not calculate correctly.

---

## ✅ Success Criteria

All tests should pass:
- ✅ Multi-sport switching works smoothly
- ✅ Soccer attributes and play styles display correctly
- ✅ Stats calculate from actual ratings (not mock values)
- ✅ Ratings/cosigns/last played filtered by active sport
- ✅ Backwards compatibility maintained
- ✅ Light/dark mode parity
- ✅ No console errors
- ✅ Performance is acceptable (< 2s for sport switching)

---

## 📝 Test Results Template

```
Date: __________
Tester: __________

Test Suite 1: Multi-Sport Support
- 1.1 Home Snapshot: ✅ / ❌
- 1.2 Athlete Profile: ✅ / ❌

Test Suite 2: Soccer Implementation
- 2.1 Setup: ✅ / ❌
- 2.2 Attributes: ✅ / ❌
- 2.3 Play Styles: ✅ / ❌
- 2.4 Stats Calculation: ✅ / ❌

Test Suite 3: Edge Cases
- 3.1 Missing Data: ✅ / ❌
- 3.2 Backwards Compatibility: ✅ / ❌

Test Suite 4: Light/Dark Mode
- 4.1 Home Snapshot: ✅ / ❌
- 4.2 Profile: ✅ / ❌
- 4.3 Self Ratings: ✅ / ❌

Test Suite 5: Performance
- 5.1 Switching: ✅ / ❌
- 5.2 Data Consistency: ✅ / ❌

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
