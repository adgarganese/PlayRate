-- Client-only create_notification RPCs (same silent-fail class as DMs before
-- 20260908220000). Likes/reposts *did* insert on 2026-09-08, so the RPC is not
-- globally dead — these triggers are belt-and-suspenders for lock-screen push.
--
-- Types must match the client + Edge Function prefs:
--   highlight_like, highlight_comment, new_follower, run_join, cosign
-- Do NOT reuse leftover notifications-migration.sql types ('like' / 'follow').
--
-- APPLY VIA SQL EDITOR. Do not apply while TestFlight 29 is the only binary
-- testers use unless you accept duplicate notifications: 29 still calls the
-- client RPC after insert. Apply the same day you ship a binary that removes
-- those createInAppNotification calls (lib/highlights.ts, hooks/useFollow.ts,
-- lib/runs.ts, lib/recap.ts).
--
-- Also skips create_notification rate-limit when called from a trigger
-- (recompute_rep already did this; create_notification did not).

CREATE OR REPLACE FUNCTION public.notification_actor_label(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(p.name), ''), p.username, 'Someone')
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
$$;

ALTER FUNCTION public.notification_actor_label(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_body text,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Triggers (DMs, social) must not share the client RPC 50/min bucket.
  IF pg_trigger_depth() = 0 THEN
    PERFORM public.check_rate_limit('create_notification', 50, 60);
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    entity_type,
    entity_id,
    title,
    body,
    metadata
  )
  VALUES (
    p_user_id,
    p_actor_id,
    p_type,
    p_entity_type,
    p_entity_id,
    p_title,
    p_body,
    p_metadata
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ========== highlight like ==========
CREATE OR REPLACE FUNCTION public.trigger_notify_on_highlight_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  owner_id uuid;
BEGIN
  SELECT h.user_id INTO owner_id FROM public.highlights h WHERE h.id = NEW.highlight_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.create_notification(
      owner_id,
      NEW.user_id,
      'highlight_like',
      'highlight',
      NEW.highlight_id,
      public.notification_actor_label(NEW.user_id) || ' liked your highlight',
      NULL,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_on_highlight_like: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_highlight_like() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_on_highlight_like ON public.highlight_likes;
DROP TRIGGER IF EXISTS on_highlight_like_inserted_notify ON public.highlight_likes;
CREATE TRIGGER on_highlight_like_inserted_notify
  AFTER INSERT ON public.highlight_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_highlight_like();

-- ========== highlight comment (owner only, same as client) ==========
CREATE OR REPLACE FUNCTION public.trigger_notify_on_highlight_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  owner_id uuid;
  preview text;
BEGIN
  SELECT h.user_id INTO owner_id FROM public.highlights h WHERE h.id = NEW.highlight_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  preview := left(NEW.body, 120);
  IF char_length(NEW.body) > 120 THEN
    preview := left(NEW.body, 117) || '...';
  END IF;
  BEGIN
    PERFORM public.create_notification(
      owner_id,
      NEW.user_id,
      'highlight_comment',
      'highlight',
      NEW.highlight_id,
      public.notification_actor_label(NEW.user_id) || ' commented on your highlight',
      preview,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_on_highlight_comment: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_highlight_comment() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_on_highlight_comment ON public.highlight_comments;
DROP TRIGGER IF EXISTS on_highlight_comment_inserted_notify ON public.highlight_comments;
CREATE TRIGGER on_highlight_comment_inserted_notify
  AFTER INSERT ON public.highlight_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_highlight_comment();

-- ========== follow (toggle_follow RPC inserts here) ==========
CREATE OR REPLACE FUNCTION public.trigger_notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.following_id IS NULL OR NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.create_notification(
      NEW.following_id,
      NEW.follower_id,
      'new_follower',
      'user',
      NEW.follower_id,
      public.notification_actor_label(NEW.follower_id) || ' started following you',
      NULL,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_on_follow: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_follow() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_on_follow ON public.follows;
DROP TRIGGER IF EXISTS on_follow_inserted_notify ON public.follows;
CREATE TRIGGER on_follow_inserted_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_follow();

-- ========== run join ==========
CREATE OR REPLACE FUNCTION public.trigger_notify_on_run_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  creator uuid;
BEGIN
  IF NEW.join_status IS DISTINCT FROM 'joined' THEN
    RETURN NEW;
  END IF;
  SELECT r.creator_id INTO creator FROM public.runs r WHERE r.id = NEW.run_id;
  IF creator IS NULL OR creator = NEW.user_id THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.create_notification(
      creator,
      NEW.user_id,
      'run_join',
      'run',
      NEW.run_id,
      public.notification_actor_label(NEW.user_id) || ' joined your run',
      NULL,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_on_run_join: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_run_join() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_run_participant_inserted_notify ON public.run_participants;
CREATE TRIGGER on_run_participant_inserted_notify
  AFTER INSERT ON public.run_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_run_join();

-- ========== cosign ==========
CREATE OR REPLACE FUNCTION public.trigger_notify_on_cosign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  attr_label text;
BEGIN
  IF NEW.to_user_id IS NULL OR NEW.from_user_id = NEW.to_user_id THEN
    RETURN NEW;
  END IF;
  attr_label := CASE NEW.attribute
    WHEN 'shooting' THEN 'Shooting'
    WHEN 'handles' THEN 'Handles'
    WHEN 'finishing' THEN 'Finishing'
    WHEN 'defense' THEN 'Defense'
    WHEN 'iq' THEN 'IQ'
    WHEN 'passing' THEN 'Passing'
    WHEN 'rebounding' THEN 'Rebounding'
    WHEN 'hustle' THEN 'Hustle'
    WHEN 'athleticism' THEN 'Athleticism'
    WHEN 'leadership' THEN 'Leadership'
    WHEN 'dribbling' THEN 'Dribbling'
    WHEN 'perimeter-defense' THEN 'Perimeter Defense'
    WHEN 'playmaking' THEN 'Playmaking'
    WHEN 'post-defense' THEN 'Post Defense'
    ELSE initcap(replace(NEW.attribute, '-', ' '))
  END;
  BEGIN
    PERFORM public.create_notification(
      NEW.to_user_id,
      NEW.from_user_id,
      'cosign',
      CASE WHEN NEW.run_id IS NULL THEN 'profile' ELSE 'run' END,
      NEW.run_id,
      public.notification_actor_label(NEW.from_user_id) || ' cosigned you (' || attr_label || ')',
      NEW.note,
      jsonb_build_object('attribute', NEW.attribute)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_on_cosign: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_cosign() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_cosign_inserted_notify ON public.cosigns;
CREATE TRIGGER on_cosign_inserted_notify
  AFTER INSERT ON public.cosigns
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_cosign();
