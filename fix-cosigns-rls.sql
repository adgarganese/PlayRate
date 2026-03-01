-- Fix: cosigns RLS policy re-evaluates auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Authenticated users can insert cosigns" ON cosigns;
CREATE POLICY "Authenticated users can insert cosigns" ON cosigns FOR INSERT WITH CHECK ((select auth.uid()) = from_user_id);
