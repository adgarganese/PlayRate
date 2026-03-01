-- ============================================
-- ATHLETE APP DATABASE SETUP
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: CREATE TABLES (schema.sql)
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Sports table
CREATE TABLE IF NOT EXISTS sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_name ON sports(name);

-- Sport attributes table
CREATE TABLE IF NOT EXISTS sport_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sport_attributes_sport_id ON sport_attributes(sport_id);

-- Self ratings table
CREATE TABLE IF NOT EXISTS self_ratings (
  profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES sport_attributes(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 10),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_self_ratings_profile_id ON self_ratings(profile_id);
CREATE INDEX IF NOT EXISTS idx_self_ratings_attribute_id ON self_ratings(attribute_id);

-- Cosigns table
CREATE TABLE IF NOT EXISTS cosigns (
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES sport_attributes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_user_id, to_profile_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_cosigns_to_profile_id ON cosigns(to_profile_id);
CREATE INDEX IF NOT EXISTS idx_cosigns_attribute_id ON cosigns(attribute_id);
CREATE INDEX IF NOT EXISTS idx_cosigns_from_user_id ON cosigns(from_user_id);

-- Courts table
CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courts_created_by ON courts(created_by);
CREATE INDEX IF NOT EXISTS idx_courts_location ON courts(lat, lng);

-- Court sports junction table
CREATE TABLE IF NOT EXISTS court_sports (
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  PRIMARY KEY (court_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_court_sports_court_id ON court_sports(court_id);
CREATE INDEX IF NOT EXISTS idx_court_sports_sport_id ON court_sports(sport_id);

-- Court comments table
CREATE TABLE IF NOT EXISTS court_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_comments_court_id ON court_comments(court_id);
CREATE INDEX IF NOT EXISTS idx_court_comments_user_id ON court_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_court_comments_created_at ON court_comments(created_at DESC);

-- Followed courts table
CREATE TABLE IF NOT EXISTS followed_courts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, court_id)
);

CREATE INDEX IF NOT EXISTS idx_followed_courts_user_id ON followed_courts(user_id);
CREATE INDEX IF NOT EXISTS idx_followed_courts_court_id ON followed_courts(court_id);

-- ============================================
-- PART 2: ENABLE RLS AND CREATE POLICIES (rls.sql)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_courts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

DROP POLICY IF EXISTS "Anyone can read self ratings" ON self_ratings;
DROP POLICY IF EXISTS "Users can insert their own self ratings" ON self_ratings;
DROP POLICY IF EXISTS "Users can update their own self ratings" ON self_ratings;

DROP POLICY IF EXISTS "Anyone can read cosigns" ON cosigns;
DROP POLICY IF EXISTS "Authenticated users can insert cosigns" ON cosigns;

DROP POLICY IF EXISTS "Anyone can read courts" ON courts;
DROP POLICY IF EXISTS "Users can insert courts" ON courts;
DROP POLICY IF EXISTS "Creators can update courts" ON courts;

DROP POLICY IF EXISTS "Anyone can read court sports" ON court_sports;
DROP POLICY IF EXISTS "Users can insert court sports for their courts" ON court_sports;

DROP POLICY IF EXISTS "Anyone can read court comments" ON court_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON court_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON court_comments;

DROP POLICY IF EXISTS "Users can read their own followed courts" ON followed_courts;
DROP POLICY IF EXISTS "Users can insert their own followed courts" ON followed_courts;
DROP POLICY IF EXISTS "Users can delete their own followed courts" ON followed_courts;

-- Profiles policies
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING ((select auth.uid()) = user_id);

-- Self ratings policies
CREATE POLICY "Anyone can read self ratings" ON self_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own self ratings" ON self_ratings FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);
CREATE POLICY "Users can update their own self ratings" ON self_ratings FOR UPDATE USING ((select auth.uid()) = profile_id);

-- Cosigns policies
CREATE POLICY "Anyone can read cosigns" ON cosigns FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert cosigns" ON cosigns FOR INSERT WITH CHECK ((select auth.uid()) = from_user_id);

-- Courts policies
CREATE POLICY "Anyone can read courts" ON courts FOR SELECT USING (true);
CREATE POLICY "Users can insert courts" ON courts FOR INSERT WITH CHECK ((select auth.uid()) = created_by);
CREATE POLICY "Creators can update courts" ON courts FOR UPDATE USING ((select auth.uid()) = created_by);

-- Court sports policies
CREATE POLICY "Anyone can read court sports" ON court_sports FOR SELECT USING (true);
CREATE POLICY "Users can insert court sports for their courts" ON court_sports 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courts 
      WHERE courts.id = court_sports.court_id 
      AND courts.created_by = (select auth.uid())
    )
  );

-- Court comments policies
CREATE POLICY "Anyone can read court comments" ON court_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON court_comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own comments" ON court_comments FOR DELETE USING ((select auth.uid()) = user_id);

-- Followed courts policies
CREATE POLICY "Users can read their own followed courts" ON followed_courts FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own followed courts" ON followed_courts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own followed courts" ON followed_courts FOR DELETE USING ((select auth.uid()) = user_id);

-- Sports policies
DROP POLICY IF EXISTS "Anyone can read sports" ON sports;
CREATE POLICY "Anyone can read sports" ON sports FOR SELECT USING (true);

-- Sport attributes policies
DROP POLICY IF EXISTS "Anyone can read sport attributes" ON sport_attributes;
CREATE POLICY "Anyone can read sport attributes" ON sport_attributes FOR SELECT USING (true);

-- ============================================
-- PART 3: CREATE FUNCTIONS AND TRIGGERS (functions.sql)
-- ============================================

CREATE OR REPLACE FUNCTION validate_self_rating_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if rating changed and validate ±1 constraint
  IF NEW.rating != OLD.rating THEN
    IF ABS(NEW.rating - OLD.rating) > 1 THEN
      RAISE EXCEPTION 'Rating change must be within ±1 of previous rating';
    END IF;
  END IF;

  -- Check if at least 30 days have passed since last_updated
  IF NOW() - OLD.last_updated < INTERVAL '30 days' THEN
    RAISE EXCEPTION 'At least 30 days must have passed since last update';
  END IF;

  -- Automatically update last_updated on valid changes
  NEW.last_updated = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Drop trigger if exists
DROP TRIGGER IF EXISTS self_ratings_update_validation ON self_ratings;

CREATE TRIGGER self_ratings_update_validation
  BEFORE UPDATE ON self_ratings
  FOR EACH ROW
  EXECUTE FUNCTION validate_self_rating_update();

-- ============================================
-- PART 4: ADD CONSTRAINTS AND PROTECTIONS (cosigns.sql)
-- ============================================

-- Prevent users from cosigning themselves
ALTER TABLE cosigns DROP CONSTRAINT IF EXISTS cosigns_no_self_cosign;
ALTER TABLE cosigns ADD CONSTRAINT cosigns_no_self_cosign CHECK (from_user_id != to_profile_id);

-- Prevent UPDATE and DELETE on cosigns table
CREATE OR REPLACE FUNCTION prevent_cosigns_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Updates to cosigns are not allowed';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deletes from cosigns are not allowed';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Drop trigger if exists
DROP TRIGGER IF EXISTS cosigns_prevent_update_delete ON cosigns;

CREATE TRIGGER cosigns_prevent_update_delete
  BEFORE UPDATE OR DELETE ON cosigns
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cosigns_update_delete();

-- ============================================
-- PART 5: AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Extract username from user metadata or use email prefix
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  
  -- Ensure username is not empty and is unique
  IF v_username IS NULL OR v_username = '' THEN
    v_username := 'user_' || substring(NEW.id::text from 1 for 8);
  END IF;
  
  -- Insert profile
  INSERT INTO public.profiles (user_id, username, name, bio)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
  SET username = EXCLUDED.username
  WHERE profiles.username IS NULL OR profiles.username = '';
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

