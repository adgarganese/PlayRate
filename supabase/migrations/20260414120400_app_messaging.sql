-- Direct messaging tables + get_or_create_conversation RPC (lib/dms.ts).

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z'::timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RPC: get_or_create_conversation(other_user_id uuid) -> uuid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  conv_id uuid;
  participant_count int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF other_user_id IS NULL OR other_user_id = me THEN
    RAISE EXCEPTION 'Invalid conversation peer';
  END IF;

  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE EXISTS (
    SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = c.id AND p.user_id = me
  )
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = c.id AND p.user_id = other_user_id
  )
  AND (
    SELECT COUNT(*)::int FROM public.conversation_participants p
    WHERE p.conversation_id = c.id
  ) = 2
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  INSERT INTO public.conversations (last_message_at)
  VALUES (NULL)
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
  VALUES
    (conv_id, me, now()),
    (conv_id, other_user_id, now());

  RETURN conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversation_participants_select_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_own"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Pair rows are normally inserted by get_or_create_conversation (SECURITY DEFINER).
-- Policy allows a row only when the row is for the current user (covers edge tooling).
DROP POLICY IF EXISTS "conversation_participants_insert_self" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_self"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversation_participants_update_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_update_own"
  ON public.conversation_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = messages.conversation_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant_sender" ON public.messages;
CREATE POLICY "messages_insert_participant_sender"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = messages.conversation_id AND p.user_id = auth.uid()
    )
  );

GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
