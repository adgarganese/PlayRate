# Tier System Implementation

## Overview

The tier system is based on the total number of cosigns received by a user (not per-attribute). Tiers provide a way to recognize athletes based on community validation.

## Tiers

- **Rookie**: 0-4 cosigns
- **Proven**: 5-14 cosigns
- **Hooper**: 15-39 cosigns
- **Certified**: 40-99 cosigns
- **Elite**: 100+ cosigns

## Database Changes

### New Cosigns Table Structure

The cosigns table has been restructured from attribute-specific to user-to-user:

```sql
CREATE TABLE cosigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);
```

**Key Changes:**
- Removed `attribute_id` column (cosigns are now per-user, not per-attribute)
- Added `id` as primary key
- Changed `to_profile_id` to `to_user_id` for consistency
- Unique constraint ensures one cosign per user pair

### Profile Table Updates

Added two new columns to `profiles`:
- `cosign_count INT NOT NULL DEFAULT 0` - Total cosigns received
- `tier TEXT` - Current tier (Rookie, Proven, Hooper, Certified, Elite)

### Automatic Updates

A database trigger automatically updates `cosign_count` and `tier` in the profiles table whenever a cosign is inserted or deleted. This ensures optimal performance without needing to count cosigns on every query.

## Migration Instructions

1. **Backup your database** before running the migration
2. Run the migration SQL file:
   ```sql
   -- Execute tier-system-migration.sql in your Supabase SQL editor
   ```
3. The migration will:
   - Drop the old cosigns table (⚠️ This deletes existing cosign data)
   - Create the new cosigns table structure
   - Add cosign_count and tier columns to profiles
   - Set up RLS policies
   - Create trigger for automatic updates
   - Initialize existing profiles with cosign counts and tiers

## Code Implementation

### Helper Functions

Located in `lib/tiers.ts`:

- `getTierFromCosigns(count: number): Tier` - Calculate tier from cosign count
- `getTierInfo(tier: Tier): TierInfo` - Get tier information (colors, ranges)
- `getTierInfoFromCosigns(count: number): TierInfo` - Get tier info from count

### Components

1. **TierPill** (`components/TierPill.tsx`)
   - Displays tier as a styled badge
   - Supports small, medium, large sizes
   - Theme-aware colors

2. **YourSnapshotCard** (`components/YourSnapshotCard.tsx`)
   - Shows user's current tier
   - Displays stats: Ratings count, Cosign count, Last played
   - Includes info icon explaining tier system
   - Clickable to navigate to profile

### Home Screen Integration

The "Your Snapshot" card appears on the home screen for authenticated users, showing:
- Tier badge next to the title
- Info icon with tooltip: "Tier is based on cosigns received"
- Stats row: "Ratings: X • Cosigns: Y • Last played: Z"

## RLS Policies

The cosigns table has the following RLS policies:

1. **Read**: Anyone can read cosigns (for counting)
2. **Insert**: Users can only insert cosigns where `auth.uid() = from_user_id`
3. **Self-cosign prevention**: Check constraint prevents `from_user_id = to_user_id`

## Usage Examples

### Getting a user's tier

```typescript
import { getTierFromCosigns } from '@/lib/tiers';

const cosignCount = 25;
const tier = getTierFromCosigns(cosignCount); // Returns 'Hooper'
```

### Displaying tier badge

```tsx
import { TierPill } from '@/components/TierPill';

<TierPill tier="Hooper" size="medium" />
```

### Fetching user's cosign count

```typescript
// Option 1: Use cached value from profiles table (recommended)
const { data: profile } = await supabase
  .from('profiles')
  .select('cosign_count, tier')
  .eq('user_id', userId)
  .single();

// Option 2: Count directly (fallback)
const { count } = await supabase
  .from('cosigns')
  .select('*', { count: 'exact', head: true })
  .eq('to_user_id', userId);
```

## Notes

- Tier is based on **total cosigns received**, not per-attribute
- Cosigns are unique per user pair (one user can cosign another user once)
- Users cannot cosign themselves
- The database trigger automatically maintains `cosign_count` and `tier` for optimal performance
- If the trigger isn't working, the app falls back to counting cosigns client-side
