-- ============================================
-- MULTI-SPORT SUPPORT MIGRATION
-- Adds sport-specific profiles and active sport selection
-- ============================================

-- Step 1: Add active_sport_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS active_sport_id UUID REFERENCES sports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_sport_id ON profiles(active_sport_id);

-- Step 2: Create sport_profiles table for sport-specific data
-- This stores data that varies by sport (play_style, position, etc.)
CREATE TABLE IF NOT EXISTS sport_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  play_style TEXT, -- Sport-specific play style
  position TEXT, -- Future: position/role in this sport
  bio TEXT, -- Optional: sport-specific bio
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_sport_profiles_user_id ON sport_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sport_profiles_sport_id ON sport_profiles(sport_id);
CREATE INDEX IF NOT EXISTS idx_sport_profiles_user_sport ON sport_profiles(user_id, sport_id);

-- Step 3: Migrate existing play_style data to sport_profiles
-- This creates a sport_profile for each user's active sport (or first sport) with their play_style
INSERT INTO sport_profiles (user_id, sport_id, play_style, created_at, updated_at)
SELECT 
  p.user_id,
  ps.sport_id,
  p.play_style,
  NOW(),
  NOW()
FROM profiles p
INNER JOIN profile_sports ps ON ps.profile_id = p.user_id
WHERE p.play_style IS NOT NULL AND p.play_style != ''
ON CONFLICT (user_id, sport_id) DO NOTHING;

-- Step 4: Set active_sport_id for users who have sports but no active sport
-- Set it to their first sport (alphabetically)
UPDATE profiles p
SET active_sport_id = (
  SELECT ps.sport_id
  FROM profile_sports ps
  INNER JOIN sports s ON s.id = ps.sport_id
  WHERE ps.profile_id = p.user_id
  ORDER BY s.name ASC
  LIMIT 1
)
WHERE p.active_sport_id IS NULL
AND EXISTS (
  SELECT 1 FROM profile_sports ps WHERE ps.profile_id = p.user_id
);

-- Step 5: Enable RLS on sport_profiles
ALTER TABLE sport_profiles ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for sport_profiles
DROP POLICY IF EXISTS "Anyone can read sport profiles" ON sport_profiles;
CREATE POLICY "Anyone can read sport profiles" ON sport_profiles 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can insert their own sport profiles" ON sport_profiles 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can update their own sport profiles" ON sport_profiles 
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can delete their own sport profiles" ON sport_profiles 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Step 7: Update RLS policy for profiles.active_sport_id
-- Users can update their own active_sport_id (existing UPDATE policy should cover this)

-- Step 8: Create function to auto-create sport_profile when user adds a sport
CREATE OR REPLACE FUNCTION auto_create_sport_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user adds a sport to profile_sports, create a sport_profile entry if it doesn't exist
  INSERT INTO sport_profiles (user_id, sport_id, created_at, updated_at)
  VALUES (NEW.profile_id, NEW.sport_id, NOW(), NOW())
  ON CONFLICT (user_id, sport_id) DO NOTHING;
  
  -- If user has no active_sport_id, set this as active
  UPDATE profiles
  SET active_sport_id = NEW.sport_id
  WHERE user_id = NEW.profile_id
  AND active_sport_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Step 9: Create trigger to auto-create sport_profile
DROP TRIGGER IF EXISTS trigger_auto_create_sport_profile ON profile_sports;
CREATE TRIGGER trigger_auto_create_sport_profile
  AFTER INSERT ON profile_sports
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_sport_profile();

-- Step 10: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sport_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Step 11: Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_sport_profile_timestamp ON sport_profiles;
CREATE TRIGGER trigger_update_sport_profile_timestamp
  BEFORE UPDATE ON sport_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_sport_profile_updated_at();

-- Comments for documentation
COMMENT ON TABLE sport_profiles IS 'Sport-specific profile data (play_style, position, etc.)';
COMMENT ON COLUMN profiles.active_sport_id IS 'Currently selected sport for display on Home Snapshot';
COMMENT ON COLUMN sport_profiles.play_style IS 'Play style for this specific sport';
COMMENT ON COLUMN sport_profiles.position IS 'Position/role in this sport (future use)';
COMMENT ON COLUMN sport_profiles.bio IS 'Optional sport-specific bio';
