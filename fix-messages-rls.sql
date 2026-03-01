-- Fix: messages RLS policies re-evaluate auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant_sender" ON public.messages;
CREATE POLICY "messages_insert_participant_sender" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
    )
  );
