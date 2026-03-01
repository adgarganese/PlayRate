-- Fix: follows RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users can insert own follows" ON public.follows;
CREATE POLICY "Users can insert own follows"
  ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own follows" ON public.follows;
CREATE POLICY "Users can delete own follows"
  ON public.follows FOR DELETE TO authenticated USING (follower_id = (select auth.uid()));
