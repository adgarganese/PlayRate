-- Follows table migration
-- Run this in Supabase SQL Editor

-- TABLE: public.follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- Indexes for performant queries
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read follows (for counts and lists)
CREATE POLICY "Authenticated users can read follows"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only when follower_id = current user
CREATE POLICY "Users can insert own follows"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

-- DELETE: only own follow rows
CREATE POLICY "Users can delete own follows"
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = (select auth.uid()));

-- No UPDATE policy (not needed for follows)

-- RPC: toggle_follow(target_user uuid) returns boolean
-- Returns true if now following, false if unfollowed
CREATE OR REPLACE FUNCTION public.toggle_follow(target_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid uuid := auth.uid();
  exists_row boolean;
  result boolean;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user = current_uid THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM follows
    WHERE follower_id = current_uid AND following_id = target_user
  ) INTO exists_row;

  IF exists_row THEN
    DELETE FROM follows
    WHERE follower_id = current_uid AND following_id = target_user;
    result := false;
  ELSE
    INSERT INTO follows (follower_id, following_id)
    VALUES (current_uid, target_user);
    result := true;
  END IF;

  RETURN result;
END;
$$;

-- RPC: get_follow_counts(target_user uuid) returns jsonb
-- Returns { followers: int, following: int }
CREATE OR REPLACE FUNCTION public.get_follow_counts(target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  followers_count bigint;
  following_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count
  FROM follows
  WHERE following_id = target_user;

  SELECT COUNT(*) INTO following_count
  FROM follows
  WHERE follower_id = target_user;

  RETURN jsonb_build_object(
    'followers', COALESCE(followers_count::int, 0),
    'following', COALESCE(following_count::int, 0)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated;
