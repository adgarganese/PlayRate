# Duplicate Court Prevention Implementation

## Summary

Implemented duplicate address prevention to ensure the same address cannot be used twice when creating courts.

## Files Changed

### 1. `app/courts/new.tsx`
- **Modified**: `handleSubmit()` function
- **Changes**:
  - Added duplicate address check BEFORE geocoding/inserting
  - Normalizes addresses (lowercase, trim, collapse spaces) for comparison
  - Checks database for existing courts with the same normalized address
  - Shows user-friendly alert if duplicate found
  - Redirects to existing court if duplicate detected
  - Kept database constraint error handling as backup

### 2. `add-unique-address-constraint.sql` (NEW)
- **Created**: SQL migration for database-level duplicate prevention
- **Purpose**: Adds unique index on address field (case-insensitive, trimmed)
- **Notes**: 
  - Uses partial unique index (`WHERE address IS NOT NULL`)
  - Allows multiple NULL addresses
  - Enforces uniqueness on non-null addresses only
  - Uses `LOWER(TRIM(address))` for case-insensitive, space-normalized comparison

## Implementation Details

### Normalization Logic
Addresses are normalized using:
- `.trim()` - Remove leading/trailing whitespace
- `.toLowerCase()` - Case-insensitive comparison
- `.replace(/\s+/g, ' ')` - Collapse multiple spaces to single space

Example:
- "  1600  AMPHITHEATRE   PARKWAY  " → "1600 amphitheatre parkway"
- "1600 Amphitheatre Parkway" → "1600 amphitheatre parkway"
- "1600  Amphitheatre Parkway" → "1600 amphitheatre parkway"

All of the above are treated as duplicates.

### Duplicate Detection Flow

1. **User submits form** with address
2. **Client-side check** (before database insert):
   - Normalize the input address
   - Query all courts with non-null addresses
   - Compare normalized addresses
   - If match found → Show alert and redirect to existing court
3. **If no duplicate found**:
   - Proceed with geocoding
   - Insert court into database
4. **Database constraint** (backup):
   - If somehow a duplicate gets through, database constraint catches it
   - Returns error code `23505` (unique violation)
   - User sees error message

## Database Migration

### To Apply the Constraint:

1. Open Supabase SQL Editor
2. Run the migration: `add-unique-address-constraint.sql`

```sql
-- Drop constraint/index if it exists (for idempotency)
DROP INDEX IF EXISTS public.courts_address_unique;
ALTER TABLE public.courts DROP CONSTRAINT IF EXISTS courts_address_unique;

-- Add unique index on address (allows multiple NULLs, but each non-null address must be unique)
CREATE UNIQUE INDEX courts_address_unique ON public.courts (LOWER(TRIM(address)))
WHERE address IS NOT NULL;
```

### Important Notes:

- **Partial Unique Index**: Only applies to non-null addresses
- **Case-Insensitive**: Uses `LOWER()` for comparison
- **Space-Normalized**: Uses `TRIM()` to ignore leading/trailing spaces
- **Multiple NULLs Allowed**: Courts with NULL addresses can coexist
- **Database-Level Enforcement**: Provides backup if client-side check fails

## Testing Guide

### Test 1: Exact Duplicate
**Steps:**
1. Create court with address: "1600 Amphitheatre Parkway, Mountain View, CA"
2. Try to create another court with same address
3. Verify duplicate detection

**Expected:**
- Alert: "Court Already Exists"
- Redirects to existing court
- Second court is NOT created

### Test 2: Case Variation
**Steps:**
1. Create court with: "Times Square, New York, NY"
2. Try to create with: "times square, new york, ny"
3. Verify they're treated as duplicates

**Expected:**
- Treated as duplicate
- Alert shown, redirect to existing court

### Test 3: Space Variation
**Steps:**
1. Create court with: "Central Park, New York"
2. Try to create with: "  Central   Park  ,  New   York  "
3. Verify normalization works

**Expected:**
- Treated as duplicate
- Extra spaces normalized

### Test 4: Similar but Different Addresses
**Steps:**
1. Create court with: "123 Main St, New York"
2. Try to create with: "123 Main Street, New York"
3. Verify they're NOT treated as duplicates

**Expected:**
- NOT treated as duplicates (different addresses)
- Both courts created successfully

### Test 5: NULL Addresses
**Steps:**
1. Check if courts with NULL addresses can coexist
2. Verify NULL addresses don't trigger duplicate check

**Expected:**
- Multiple courts with NULL addresses allowed
- No false positives for NULL addresses

## Edge Cases Handled

✅ **Case Insensitivity**: "Main St" = "main st" = "MAIN ST"
✅ **Space Normalization**: "Main St" = "  Main   St  "
✅ **Multiple NULLs**: NULL addresses don't conflict
✅ **Race Conditions**: Database constraint provides backup
✅ **User Experience**: Clear error message with redirect option
✅ **Performance**: Check happens before geocoding (saves API calls)

## Limitations

1. **Exact Match Only**: "123 Main St" ≠ "123 Main Street" (different addresses)
2. **No Fuzzy Matching**: Typos will create new courts (e.g., "Main St" vs "Main St.")
3. **Client-Side Check**: Race conditions possible (database constraint is backup)
4. **Address Variations**: Abbreviations not normalized (St vs Street, Ave vs Avenue)

## Future Enhancements (Optional)

- Fuzzy address matching (handle typos)
- Address normalization (St → Street, Ave → Avenue)
- Geocoding-based duplicate detection (coordinates within X meters)
- Admin merge tool for duplicates
