-- ============================================
-- DMs (1:1 Direct Messages) - Supabase Migration
-- Run in Supabase SQL Editor
-- ============================================

-- 1) conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

-- 2) conversation_participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);

-- 3) messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS: conversations - SELECT only if user is a participant
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = (select auth.uid())
    )
  );

-- RLS: conversation_participants - SELECT only own rows (client derives "other" from messages when needed)
CREATE POLICY "conversation_participants_select_own" ON public.conversation_participants
  FOR SELECT
  USING (user_id = (select auth.uid()));

-- RLS: conversation_participants - UPDATE only own rows (last_read_at)
CREATE POLICY "conversation_participants_update_own" ON public.conversation_participants
  FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- RLS: conversation_participants - INSERT (via RPC only; allow for new convos)
CREATE POLICY "conversation_participants_insert_own" ON public.conversation_participants
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- RLS: messages - SELECT only if user is participant
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
    )
  );

-- RLS: messages - INSERT only if user is participant and sender_id = auth.uid()
CREATE POLICY "messages_insert_participant_sender" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
    )
  );

-- RLS: conversations - INSERT blocked for clients; creation only via get_or_create_conversation RPC (SECURITY DEFINER)
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT
  WITH CHECK (false);

-- RLS: conversations - UPDATE so participants can set last_message_at when sending
DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant" ON public.conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = (select auth.uid())
    )
  );

-- RPC: get_or_create_conversation(other_user_id uuid) -> conversation_id uuid
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := auth.uid();
  conv_id uuid;
  existing_conv_id uuid;
BEGIN
  IF me_id IS NULL OR other_user_id IS NULL OR me_id = other_user_id THEN
    RAISE EXCEPTION 'Invalid users for conversation';
  END IF;

  -- Find existing 1:1 conversation with exactly these two participants
  SELECT c.id INTO existing_conv_id
  FROM conversations c
  INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = me_id
  INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = other_user_id
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (id) VALUES (gen_random_uuid()) RETURNING id INTO conv_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (conv_id, me_id), (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;

-- Enable Realtime for messages (so chat screen can subscribe)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
