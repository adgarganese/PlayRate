-- ============================================
-- TIER SYSTEM MIGRATION
-- Creates new cosigns table structure and tier system
-- ============================================

-- Step 1: Create new cosigns table (user-to-user, not attribute-specific)
-- Drop old cosigns table if it exists (backup first if needed!)
-- Note: This will delete existing cosign data. Adjust if you need to migrate data.

DROP TABLE IF EXISTS cosigns CASCADE;

CREATE TABLE cosigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enforce unique cosign per pair
  UNIQUE(from_user_id, to_user_id)
);

-- Indexes for performance
CREATE INDEX idx_cosigns_from_user_id ON cosigns(from_user_id);
CREATE INDEX idx_cosigns_to_user_id ON cosigns(to_user_id);
CREATE INDEX idx_cosigns_created_at ON cosigns(created_at DESC);

-- Step 2: Add cosign_count and tier columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS cosign_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT;

-- Index for tier queries
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_cosign_count ON profiles(cosign_count DESC);

-- Step 3: Enable RLS on new cosigns table
ALTER TABLE cosigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cosigns
-- Allow read access for counts
CREATE POLICY "Anyone can read cosigns" ON cosigns FOR SELECT USING (true);

-- Users can insert a cosign only when (select auth.uid()) = from_user_id
CREATE POLICY "Users can insert their own cosigns" 
  ON cosigns FOR INSERT 
  WITH CHECK ((select auth.uid()) = from_user_id);

-- Prevent self-cosigning: from_user_id != to_user_id
-- This is enforced by a check constraint
ALTER TABLE cosigns 
  ADD CONSTRAINT cosigns_no_self_cosign 
  CHECK (from_user_id != to_user_id);

-- Step 4: Create function to calculate tier from cosign count
CREATE OR REPLACE FUNCTION get_tier_from_cosigns(count INT)
RETURNS TEXT AS $$
BEGIN
  CASE
    WHEN count >= 100 THEN RETURN 'Elite';
    WHEN count >= 40 THEN RETURN 'Certified';
    WHEN count >= 15 THEN RETURN 'Hooper';
    WHEN count >= 5 THEN RETURN 'Proven';
    ELSE RETURN 'Rookie';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 5: Create function to update cosign_count and tier in profiles
CREATE OR REPLACE FUNCTION update_profile_cosign_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_count INT;
  new_tier TEXT;
BEGIN
  -- Determine which user's count to update
  IF TG_OP = 'INSERT' THEN
    target_user_id := NEW.to_user_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_user_id := OLD.to_user_id;
  ELSE
    RETURN NULL;
  END IF;

  -- Calculate new cosign count
  SELECT COUNT(*)::INT INTO new_count
  FROM cosigns
  WHERE to_user_id = target_user_id;

  -- Calculate tier
  new_tier := get_tier_from_cosigns(new_count);

  -- Update profile
  UPDATE profiles
  SET 
    cosign_count = new_count,
    tier = new_tier
  WHERE user_id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update cosign_count and tier
DROP TRIGGER IF EXISTS cosigns_update_profile_stats ON cosigns;

CREATE TRIGGER cosigns_update_profile_stats
  AFTER INSERT OR DELETE ON cosigns
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_cosign_stats();

-- Step 7: Initialize existing profiles with cosign_count and tier
-- (Run this after the trigger is created)
UPDATE profiles
SET 
  cosign_count = (
    SELECT COUNT(*)::INT
    FROM cosigns
    WHERE cosigns.to_user_id = profiles.user_id
  ),
  tier = get_tier_from_cosigns(
    (SELECT COUNT(*)::INT
     FROM cosigns
     WHERE cosigns.to_user_id = profiles.user_id)
  );
