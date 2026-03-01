-- Fix: highlights RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Read public or own highlights" ON public.highlights;
CREATE POLICY "Read public or own highlights"
  ON public.highlights FOR SELECT TO authenticated
  USING (is_public = true OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users insert own highlights" ON public.highlights;
CREATE POLICY "Users insert own highlights"
  ON public.highlights FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own highlights" ON public.highlights;
CREATE POLICY "Users update own highlights"
  ON public.highlights FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own highlights" ON public.highlights;
CREATE POLICY "Users delete own highlights"
  ON public.highlights FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
