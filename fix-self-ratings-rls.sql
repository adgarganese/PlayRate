-- Fix: self_ratings RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own self ratings" ON self_ratings;
CREATE POLICY "Users can insert their own self ratings" ON self_ratings FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "Users can update their own self ratings" ON self_ratings;
CREATE POLICY "Users can update their own self ratings" ON self_ratings FOR UPDATE USING ((select auth.uid()) = profile_id);
