-- Fix: highlight_likes RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Users insert own likes" ON public.highlight_likes;
CREATE POLICY "Users insert own likes"
  ON public.highlight_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own likes" ON public.highlight_likes;
CREATE POLICY "Users delete own likes"
  ON public.highlight_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
