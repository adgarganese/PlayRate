-- Core highlight tables required before/with highlights_with_counts (lib/highlights.ts, create flow).
-- Does not replace highlight_views / highlight_reposts / highlight_drafts (already in earlier migrations).

CREATE TABLE IF NOT EXISTS public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL DEFAULT 'basketball',
  media_type text NOT NULL CHECK (media_type IN ('video', 'image')),
  media_url text NOT NULL,
  thumbnail_url text,
  caption text,
  location_name text,
  latitude double precision,
  longitude double precision,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_created_at ON public.highlights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_is_public_created ON public.highlights(is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS public.highlight_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT highlight_likes_unique_user_highlight UNIQUE (highlight_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_likes_highlight_id ON public.highlight_likes(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_likes_user_id ON public.highlight_likes(user_id);

CREATE TABLE IF NOT EXISTS public.highlight_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  parent_id uuid REFERENCES public.highlight_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlight_comments_highlight_id ON public.highlight_comments(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_comments_parent_id ON public.highlight_comments(parent_id);

-- Older DBs may have highlight_comments without parent_id (before 20260228160000).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'highlight_comments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'highlight_comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.highlight_comments
      ADD COLUMN parent_id uuid REFERENCES public.highlight_comments(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_highlight_comments_parent_id_backfill
      ON public.highlight_comments(parent_id);
  END IF;
END $$;

-- highlight_likes.created_at is used for activity history ordering.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'highlight_likes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'highlight_likes' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.highlight_likes
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- View: highlights_with_counts (aligned with 20260408130000_highlight_reposts.sql)
-- Requires highlight_views + highlight_reposts tables (from earlier repo migrations).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'highlight_views'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'highlight_reposts'
  ) THEN
    EXECUTE $view$
CREATE OR REPLACE VIEW public.highlights_with_counts
WITH (security_invoker = true) AS
SELECT
  h.id,
  h.user_id,
  h.sport,
  h.media_type,
  h.media_url,
  h.thumbnail_url,
  h.caption,
  h.location_name,
  h.latitude,
  h.longitude,
  h.created_at,
  h.is_public,
  COALESCE(l.like_cnt, 0)::int AS like_count,
  COALESCE(c.comment_cnt, 0)::int AS comment_count,
  COALESCE(v.view_cnt, 0)::int AS view_count,
  COALESCE(r.repost_cnt, 0)::int AS repost_count
FROM public.highlights h
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS like_cnt
  FROM public.highlight_likes
  GROUP BY highlight_id
) l ON l.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS comment_cnt
  FROM public.highlight_comments
  GROUP BY highlight_id
) c ON c.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS view_cnt
  FROM public.highlight_views
  GROUP BY highlight_id
) v ON v.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS repost_cnt
  FROM public.highlight_reposts
  GROUP BY highlight_id
) r ON r.hid = h.id
    $view$;
    EXECUTE 'GRANT SELECT ON public.highlights_with_counts TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "highlights_select_public_or_owner" ON public.highlights;
CREATE POLICY "highlights_select_public_or_owner"
  ON public.highlights FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "highlights_insert_own" ON public.highlights;
CREATE POLICY "highlights_insert_own"
  ON public.highlights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlights_update_own" ON public.highlights;
CREATE POLICY "highlights_update_own"
  ON public.highlights FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlights_delete_own" ON public.highlights;
CREATE POLICY "highlights_delete_own"
  ON public.highlights FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlight_likes_select_authenticated" ON public.highlight_likes;
CREATE POLICY "highlight_likes_select_authenticated"
  ON public.highlight_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "highlight_likes_insert_own" ON public.highlight_likes;
CREATE POLICY "highlight_likes_insert_own"
  ON public.highlight_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlight_likes_delete_own" ON public.highlight_likes;
CREATE POLICY "highlight_likes_delete_own"
  ON public.highlight_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlight_comments_select_authenticated" ON public.highlight_comments;
CREATE POLICY "highlight_comments_select_authenticated"
  ON public.highlight_comments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "highlight_comments_insert_authenticated" ON public.highlight_comments;
CREATE POLICY "highlight_comments_insert_authenticated"
  ON public.highlight_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "highlight_comments_delete_own" ON public.highlight_comments;
CREATE POLICY "highlight_comments_delete_own"
  ON public.highlight_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.highlight_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.highlight_comments TO authenticated;
