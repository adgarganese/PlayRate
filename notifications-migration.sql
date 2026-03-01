-- ============================================
-- Notifications table + RLS + create_notification + triggers
-- Run in Supabase SQL Editor. Triggers are created only when their tables exist
-- (e.g. run before or after dms/follows/highlights migrations).
-- ============================================

-- TABLE: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT only own
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- RLS: UPDATE only own (e.g. set read_at)
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS: INSERT only via server/function (no direct client insert policy; triggers and SECURITY DEFINER do the insert)
-- Allow service role / trigger context. Clients do not get INSERT.

-- No DELETE from client
-- (Optional: add policy "notifications_no_delete" to deny if needed; by default without policy = no delete)

-- Helper: create_notification (SECURITY DEFINER so triggers can call it)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, title, body, metadata)
  VALUES (p_user_id, p_actor_id, p_type, p_entity_type, p_entity_id, p_title, p_body, p_metadata)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Trigger: new follower -> notify the followed user (only if public.follows exists)
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name TEXT;
BEGIN
  SELECT name INTO actor_name FROM public.profiles WHERE user_id = NEW.follower_id;
  PERFORM public.create_notification(
    NEW.following_id,
    NEW.follower_id,
    'follow',
    'profile',
    NEW.follower_id,
    COALESCE(actor_name, 'Someone') || ' started following you',
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    DROP TRIGGER IF EXISTS trigger_notify_on_follow ON public.follows;
    CREATE TRIGGER trigger_notify_on_follow
      AFTER INSERT ON public.follows
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_on_follow();
  END IF;
END $$;

-- Trigger: new like on highlight -> notify highlight owner (skip if liker is owner)
CREATE OR REPLACE FUNCTION public.notify_on_highlight_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  actor_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.highlights WHERE id = NEW.highlight_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;
  PERFORM public.create_notification(
    owner_id,
    NEW.user_id,
    'like',
    'highlight',
    NEW.highlight_id,
    COALESCE(actor_name, 'Someone') || ' liked your highlight',
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_highlight_like ON public.highlight_likes;
CREATE TRIGGER trigger_notify_on_highlight_like
  AFTER INSERT ON public.highlight_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_highlight_like();

-- Trigger: new message -> notify the other participant (skip sender)
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_user_id UUID;
  sender_name TEXT;
  snippet TEXT;
BEGIN
  SELECT user_id INTO other_user_id
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LIMIT 1;
  IF other_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  snippet := LEFT(NEW.body, 50);
  IF LENGTH(NEW.body) > 50 THEN snippet := snippet || '…'; END IF;
  PERFORM public.create_notification(
    other_user_id,
    NEW.sender_id,
    'dm',
    'conversation',
    NEW.conversation_id,
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    snippet,
    NULL
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    DROP TRIGGER IF EXISTS trigger_notify_on_message ON public.messages;
    CREATE TRIGGER trigger_notify_on_message
      AFTER INSERT ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_on_message();
  END IF;
END $$;

-- Optional: highlight_comments table (only if public.highlights exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'highlights') THEN
    CREATE TABLE IF NOT EXISTS public.highlight_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      highlight_id UUID NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_highlight_comments_highlight ON public.highlight_comments(highlight_id);
    ALTER TABLE public.highlight_comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "highlight_comments_select" ON public.highlight_comments;
    CREATE POLICY "highlight_comments_select" ON public.highlight_comments FOR SELECT USING (true);
    DROP POLICY IF EXISTS "highlight_comments_insert_own" ON public.highlight_comments;
    CREATE POLICY "highlight_comments_insert_own" ON public.highlight_comments FOR INSERT WITH CHECK (user_id = (select auth.uid()));
    DROP POLICY IF EXISTS "highlight_comments_delete_own" ON public.highlight_comments;
    CREATE POLICY "highlight_comments_delete_own" ON public.highlight_comments FOR DELETE USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- Trigger: new comment on highlight (only if highlight_comments exists)
CREATE OR REPLACE FUNCTION public.notify_on_highlight_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  actor_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.highlights WHERE id = NEW.highlight_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;
  PERFORM public.create_notification(
    owner_id,
    NEW.user_id,
    'comment',
    'highlight',
    NEW.highlight_id,
    COALESCE(actor_name, 'Someone') || ' commented on your highlight',
    LEFT(NEW.body, 80),
    NULL
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'highlight_comments') THEN
    DROP TRIGGER IF EXISTS trigger_notify_on_highlight_comment ON public.highlight_comments;
    CREATE TRIGGER trigger_notify_on_highlight_comment
      AFTER INSERT ON public.highlight_comments
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_on_highlight_comment();
  END IF;
END $$;

-- Realtime: allow clients to subscribe to their notifications (skip if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Note: top10 and share notifications can be created by calling create_notification from an Edge Function
-- or cron when weekly winners are computed / when share action exists.
-- Example for Top 10 (run from Edge Function or cron):
--   SELECT create_notification(winner_user_id, NULL, 'top10', 'highlight', highlight_id, 'Your highlight made Weekly Top 10', NULL, '{}');
