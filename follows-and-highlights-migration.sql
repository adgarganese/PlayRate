-- ============================================
-- Follows + Highlights (and highlight_likes) - Run in Supabase SQL Editor
-- Run this first, then re-run notifications-migration.sql to attach follow/like triggers
-- ============================================

-- ========== FOLLOWS ==========
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read follows" ON public.follows;
CREATE POLICY "Authenticated users can read follows"
  ON public.follows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own follows" ON public.follows;
CREATE POLICY "Users can insert own follows"
  ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own follows" ON public.follows;
CREATE POLICY "Users can delete own follows"
  ON public.follows FOR DELETE TO authenticated USING (follower_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.toggle_follow(target_user uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_uid uuid := auth.uid(); exists_row boolean; result boolean;
BEGIN
  IF current_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF target_user = current_uid THEN RAISE EXCEPTION 'Cannot follow yourself'; END IF;
  SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = current_uid AND following_id = target_user) INTO exists_row;
  IF exists_row THEN
    DELETE FROM follows WHERE follower_id = current_uid AND following_id = target_user;
    result := false;
  ELSE
    INSERT INTO follows (follower_id, following_id) VALUES (current_uid, target_user);
    result := true;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_follow_counts(target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE followers_count bigint; following_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count FROM follows WHERE following_id = target_user;
  SELECT COUNT(*) INTO following_count FROM follows WHERE follower_id = target_user;
  RETURN jsonb_build_object('followers', COALESCE(followers_count::int, 0), 'following', COALESCE(following_count::int, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated;

-- ========== HIGHLIGHTS + HIGHLIGHT_LIKES ==========
CREATE TABLE IF NOT EXISTS public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('video', 'image')),
  media_url text NOT NULL,
  thumbnail_url text NULL,
  caption text NULL,
  location_name text NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_public boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_created ON public.highlights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_created ON public.highlights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_public_created ON public.highlights(is_public, created_at DESC) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS public.highlight_likes (
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (highlight_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_likes_highlight ON public.highlight_likes(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_likes_user ON public.highlight_likes(user_id);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read public or own highlights" ON public.highlights;
CREATE POLICY "Read public or own highlights"
  ON public.highlights FOR SELECT TO authenticated
  USING (is_public = true OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users insert own highlights" ON public.highlights;
CREATE POLICY "Users insert own highlights"
  ON public.highlights FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own highlights" ON public.highlights;
CREATE POLICY "Users update own highlights"
  ON public.highlights FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own highlights" ON public.highlights;
CREATE POLICY "Users delete own highlights"
  ON public.highlights FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

ALTER TABLE public.highlight_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read likes" ON public.highlight_likes;
CREATE POLICY "Authenticated read likes"
  ON public.highlight_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own likes" ON public.highlight_likes;
CREATE POLICY "Users insert own likes"
  ON public.highlight_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own likes" ON public.highlight_likes;
CREATE POLICY "Users delete own likes"
  ON public.highlight_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE OR REPLACE VIEW public.highlights_with_counts AS
SELECT
  h.id, h.user_id, h.sport, h.media_type, h.media_url, h.thumbnail_url,
  h.caption, h.location_name, h.latitude, h.longitude, h.created_at, h.is_public,
  COALESCE(l.cnt, 0)::int AS like_count
FROM highlights h
LEFT JOIN (SELECT highlight_id AS hid, COUNT(*)::bigint AS cnt FROM highlight_likes GROUP BY highlight_id) l ON l.hid = h.id;

GRANT SELECT ON public.highlights_with_counts TO authenticated;

-- Optional: Create storage bucket "highlights" (public) in Supabase Dashboard > Storage for uploads.
