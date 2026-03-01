-- Fix: court_comments RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert their own comments" ON court_comments;
CREATE POLICY "Users can insert their own comments" ON court_comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON court_comments;
CREATE POLICY "Users can delete their own comments" ON court_comments FOR DELETE USING ((select auth.uid()) = user_id);
