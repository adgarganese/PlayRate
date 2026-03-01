-- Fix: court_ratings RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own court ratings" ON court_ratings;
CREATE POLICY "Users can insert their own court ratings" ON court_ratings 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own court ratings" ON court_ratings;
CREATE POLICY "Users can update their own court ratings" ON court_ratings 
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own court ratings" ON court_ratings;
CREATE POLICY "Users can delete their own court ratings" ON court_ratings 
  FOR DELETE USING ((select auth.uid()) = user_id);
