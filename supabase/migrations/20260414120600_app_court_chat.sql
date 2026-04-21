-- Per-court public chat (components/CourtChat.tsx).

CREATE TABLE IF NOT EXISTS public.court_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_chat_messages_court_created ON public.court_chat_messages(court_id, created_at DESC);

ALTER TABLE public.court_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_chat_messages_select_authenticated" ON public.court_chat_messages;
CREATE POLICY "court_chat_messages_select_authenticated"
  ON public.court_chat_messages FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "court_chat_messages_insert_own" ON public.court_chat_messages;
CREATE POLICY "court_chat_messages_insert_own"
  ON public.court_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.court_chat_messages TO authenticated;
