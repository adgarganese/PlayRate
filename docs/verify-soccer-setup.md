# Verify Soccer Setup - Quick Checklist

## ✅ STEP 1: Verify in Supabase

Run these queries in Supabase SQL Editor to confirm:

```sql
-- 1. Check Soccer exists
SELECT * FROM sports WHERE name = 'Soccer';

-- 2. Check Soccer attributes (should show 10)
SELECT name 
FROM sport_attributes 
WHERE sport_id = (SELECT id FROM sports WHERE name = 'Soccer') 
ORDER BY name;

-- Expected result: Should show 10 attributes:
-- Athleticism
-- Ball Control
-- Defending
-- Dribbling
-- First Touch
-- Passing
-- Shooting / Finishing
-- Speed / Acceleration
-- Stamina / Work Rate
-- Vision
```

## ✅ STEP 2: Refresh App

1. **Close "My Sports" screen** if open
2. **Reopen "My Sports" screen**
3. **Soccer should appear** in the "Add More Sports" section (or "Select Sports" if you have no sports yet)

## ✅ STEP 3: Add Soccer to Your Profile

1. **Tap the "+ Soccer" button**
2. **Soccer should move** to "My Sports" section
3. **A sport_profile entry should be auto-created** (via trigger)

## ✅ STEP 4: Test Soccer Ratings

1. **Go to "Rate Yourself" screen**
2. **Select Soccer** from the sport dropdown
3. **Verify 10 Soccer attributes appear** in this order:
   - Athleticism
   - Speed / Acceleration
   - Stamina / Work Rate
   - Ball Control
   - First Touch
   - Dribbling
   - Passing
   - Vision
   - Shooting / Finishing
   - Defending
4. **Rate some attributes** (1-10)
5. **Verify ratings save**

## ✅ STEP 5: Test Soccer Play Style

1. **Switch active sport to Soccer**:
   - Go to Home screen
   - Tap sport chip (e.g., "Basketball ▾")
   - Select "Soccer" from modal
2. **Go to Profile → Edit**
3. **Verify Soccer play styles appear**:
   - Striker / Finisher
   - Playmaker
   - Winger
   - Box-to-Box
   - Defensive Mid
   - Center Back
   - Fullback
   - Goalkeeper
   - Custom
4. **Select a play style** and save
5. **Verify it saves** and displays correctly

## 🐛 TROUBLESHOOTING

### If Soccer doesn't appear in "My Sports":

1. **Check RLS policies**:
   ```sql
   -- Verify anyone can read sports
   SELECT * FROM pg_policies WHERE tablename = 'sports';
   ```

2. **Try refreshing data**:
   - Pull to refresh on "My Sports" screen
   - Or close/reopen app

3. **Check console for errors**:
   - Look for any Supabase query errors
   - Check if `sports` table query is working

4. **Manual verification query**:
   ```sql
   -- This should return Soccer
   SELECT id, name, created_at 
   FROM sports 
   ORDER BY name;
   ```

### If attributes don't display correctly:

1. **Check attribute order**:
   - Should use `getOrderedAttributes()` from sport definitions
   - Should not be alphabetical

2. **Verify sport definitions**:
   - Check `constants/sport-definitions.ts`
   - Soccer should have 10 attributes defined

---

## 🎉 Expected Result

After setup, you should be able to:
- ✅ See Soccer in "My Sports" screen
- ✅ Add Soccer to your profile
- ✅ Rate Soccer attributes (10 attributes, 1-10 scale)
- ✅ Set Soccer play style (8 position options)
- ✅ Switch between Basketball and Soccer
- ✅ View sport-specific data correctly
