-- ============================================
-- ADD PROFILE SPORTS JUNCTION TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Profile sports junction table (which sports does a profile play?)
CREATE TABLE IF NOT EXISTS profile_sports (
  profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_sports_profile_id ON profile_sports(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_sports_sport_id ON profile_sports(sport_id);

-- Enable RLS
ALTER TABLE profile_sports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read profile sports" ON profile_sports;
CREATE POLICY "Anyone can read profile sports" ON profile_sports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile sports" ON profile_sports;
CREATE POLICY "Users can insert their own profile sports" ON profile_sports 
  FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "Users can delete their own profile sports" ON profile_sports;
CREATE POLICY "Users can delete their own profile sports" ON profile_sports 
  FOR DELETE USING ((select auth.uid()) = profile_id);

