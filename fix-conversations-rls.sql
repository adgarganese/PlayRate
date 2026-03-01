-- Fix: conversations RLS policies
-- Run in Supabase SQL Editor
--
-- 1) conversations_insert was overly permissive (WITH CHECK true) - now blocked for clients.
-- 2) conversations_select_participant and conversations_update_participant: use (select auth.uid())
--    for single evaluation per statement (performance).

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant" ON public.conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT
  WITH CHECK (false);
