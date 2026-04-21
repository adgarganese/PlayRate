-- Follow graph + RPCs used by hooks/useFollow.ts (get_follow_counts, toggle_follow).

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id),
  CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select_authenticated" ON public.follows;
CREATE POLICY "follows_select_authenticated"
  ON public.follows FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_follow_counts(target_user uuid) -> jsonb { followers, following }
-- Matches client expectation (object with numeric fields).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_follow_counts(target_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'followers', COALESCE(
      (SELECT count(*)::int FROM public.follows f WHERE f.following_id = get_follow_counts.target_user),
      0
    ),
    'following', COALESCE(
      (SELECT count(*)::int FROM public.follows f WHERE f.follower_id = get_follow_counts.target_user),
      0
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_follow_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: toggle_follow(target_user uuid) — insert or delete edge for auth.uid()
-- SECURITY DEFINER so it works regardless of strict RLS edge cases.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_follow(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
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

REVOKE ALL ON FUNCTION public.toggle_follow(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;
