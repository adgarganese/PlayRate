-- Fix: highlight_comments RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "Authenticated read comments for public highlights" ON public.highlight_comments;
CREATE POLICY "Authenticated read comments for public highlights"
  ON public.highlight_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.highlights h 
      WHERE h.id = highlight_id AND (h.is_public = true OR h.user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users insert own comments" ON public.highlight_comments;
CREATE POLICY "Users insert own comments"
  ON public.highlight_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own comments" ON public.highlight_comments;
CREATE POLICY "Users delete own comments"
  ON public.highlight_comments FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
