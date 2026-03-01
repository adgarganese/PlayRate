-- Fix: followed_courts RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can read their own followed courts" ON followed_courts;
CREATE POLICY "Users can read their own followed courts" ON followed_courts FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own followed courts" ON followed_courts;
CREATE POLICY "Users can insert their own followed courts" ON followed_courts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own followed courts" ON followed_courts;
CREATE POLICY "Users can delete their own followed courts" ON followed_courts FOR DELETE USING ((select auth.uid()) = user_id);
