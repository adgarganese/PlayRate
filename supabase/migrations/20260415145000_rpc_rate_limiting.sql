-- RPC rate limiting for SECURITY DEFINER endpoints (abuse guard).
-- Old rows are purged at the start of each check_rate_limit call (24h retention).
-- Optional: add pg_cron or dashboard job to VACUUM / trim if volume grows.

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_lookup
  ON public.rate_limit_log (user_id, action, created_at DESC);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated: users cannot read or manipulate logs.
REVOKE ALL ON TABLE public.rate_limit_log FROM PUBLIC;

COMMENT ON TABLE public.rate_limit_log IS
  'Throttle log for public RPCs. Writes only via SECURITY DEFINER check_rate_limit; not user-readable.';

-- Internal helper: not granted to authenticated (invoked only from other SECURITY DEFINER RPCs).
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action text, p_max_count int, p_window_seconds int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    -- Migrations / internal callers without JWT: do not enforce or log.
    RETURN;
  END IF;

  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - interval '24 hours';

  SELECT COUNT(*)::int INTO cnt
  FROM public.rate_limit_log
  WHERE user_id = uid
    AND action = p_action
    AND created_at >= (now() - (p_window_seconds::double precision * interval '1 second'));

  IF cnt >= p_max_count THEN
    RAISE EXCEPTION 'Rate limit exceeded for %. Try again later.', p_action;
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action)
  VALUES (uid, p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RPCs: add PERFORM check_rate_limit as first executable step in each body.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in(court_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_id uuid;
  last_ts timestamptz;
BEGIN
  PERFORM public.check_rate_limit('check_in', 10, 3600);

  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM check_ins c
    WHERE c.user_id = uid
      AND c.court_id = court_id_param
      AND (timezone('utc', c.created_at))::date = (timezone('utc', now()))::date
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already checked in at this court today.'
    );
  END IF;

  INSERT INTO check_ins (court_id, user_id)
  VALUES (court_id_param, uid)
  RETURNING id, created_at INTO new_id, last_ts;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Checked in',
    'last_check_in', last_ts,
    'check_in_id', new_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already checked in at this court today.'
    );
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Court or user not found');
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_follow(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  PERFORM public.check_rate_limit('toggle_follow', 30, 60);

  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF target_user IS NULL OR target_user = me THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = me AND f.following_id = target_user
  ) THEN
    DELETE FROM public.follows f
    WHERE f.follower_id = me AND f.following_id = target_user;
  ELSE
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (me, target_user);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  conv_id uuid;
BEGIN
  PERFORM public.check_rate_limit('get_or_create_conversation', 10, 60);

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
  PERFORM public.check_rate_limit('create_notification', 50, 60);

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

CREATE OR REPLACE FUNCTION public.recompute_rep(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_by_attr JSONB;
  v_tier TEXT;
BEGIN
  -- Cosign trigger calls would count against the inserter if we always throttled here.
  -- Only rate-limit direct RPC / non-trigger callers (pg_trigger_depth() = 0).
  IF pg_trigger_depth() = 0 THEN
    PERFORM public.check_rate_limit('recompute_rep', 5, 60);
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM cosigns
  WHERE to_user_id = p_user_id
    AND created_at >= (now() - interval '90 days');

  SELECT COALESCE(
    jsonb_object_agg(attribute, cnt),
    '{}'::jsonb
  ) INTO v_by_attr
  FROM (
    SELECT attribute, COUNT(*)::INT AS cnt
    FROM cosigns
    WHERE to_user_id = p_user_id
      AND created_at >= (now() - interval '90 days')
    GROUP BY attribute
  ) t;

  v_tier := CASE
    WHEN v_total >= 150 THEN 'Diamond'
    WHEN v_total >= 75 THEN 'Platinum'
    WHEN v_total >= 35 THEN 'Gold'
    WHEN v_total >= 15 THEN 'Silver'
    WHEN v_total >= 5 THEN 'Bronze'
    ELSE 'Unranked'
  END;

  INSERT INTO rep_rollups (user_id, total_cosigns, cosigns_by_attribute, rep_level, updated_at)
  VALUES (p_user_id, v_total, COALESCE(v_by_attr, '{}'::jsonb), v_tier, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_cosigns = EXCLUDED.total_cosigns,
    cosigns_by_attribute = EXCLUDED.cosigns_by_attribute,
    rep_level = EXCLUDED.rep_level,
    updated_at = EXCLUDED.updated_at;

  BEGIN
    UPDATE profiles
    SET rep_level = v_tier
    WHERE user_id = p_user_id;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    NULL;
  END;
END;
$$;
