-- Fix: court_photos RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own court photos" ON court_photos;
CREATE POLICY "Users can insert their own court photos" ON court_photos 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own court photos" ON court_photos;
CREATE POLICY "Users can update their own court photos" ON court_photos 
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own court photos" ON court_photos;
CREATE POLICY "Users can delete their own court photos" ON court_photos 
  FOR DELETE USING ((select auth.uid()) = user_id);
