-- Fix: conversation_participants RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "conversation_participants_select_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_own" ON public.conversation_participants
  FOR SELECT
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "conversation_participants_update_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_update_own" ON public.conversation_participants
  FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "conversation_participants_insert_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_own" ON public.conversation_participants
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
