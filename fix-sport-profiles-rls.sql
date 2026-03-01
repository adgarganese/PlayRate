-- Fix: sport_profiles RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can insert their own sport profiles" ON sport_profiles 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can update their own sport profiles" ON sport_profiles 
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own sport profiles" ON sport_profiles;
CREATE POLICY "Users can delete their own sport profiles" ON sport_profiles 
  FOR DELETE USING ((select auth.uid()) = user_id);
