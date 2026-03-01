-- Fix: courts RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert courts" ON courts;
CREATE POLICY "Users can insert courts" ON courts FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Creators can update courts" ON courts;
CREATE POLICY "Creators can update courts" ON courts FOR UPDATE USING ((select auth.uid()) = created_by);
