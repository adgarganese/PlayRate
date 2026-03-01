-- Fix: profile_sports RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own profile sports" ON profile_sports;
CREATE POLICY "Users can insert their own profile sports" ON profile_sports 
  FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "Users can delete their own profile sports" ON profile_sports;
CREATE POLICY "Users can delete their own profile sports" ON profile_sports 
  FOR DELETE USING ((select auth.uid()) = profile_id);
