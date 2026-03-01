-- Highlight Comments Migration
-- Run in Supabase SQL Editor

-- ========== HIGHLIGHT_COMMENTS TABLE ==========
CREATE TABLE IF NOT EXISTS public.highlight_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlight_comments_highlight_created 
  ON public.highlight_comments(highlight_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlight_comments_user 
  ON public.highlight_comments(user_id);

-- ========== RLS FOR HIGHLIGHT_COMMENTS ==========
ALTER TABLE public.highlight_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read comments for public highlights" ON public.highlight_comments;
CREATE POLICY "Authenticated read comments for public highlights"
  ON public.highlight_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.highlights h 
      WHERE h.id = highlight_id AND (h.is_public = true OR h.user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users insert own comments" ON public.highlight_comments;
CREATE POLICY "Users insert own comments"
  ON public.highlight_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own comments" ON public.highlight_comments;
CREATE POLICY "Users delete own comments"
  ON public.highlight_comments FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ========== UPDATE VIEW: highlights_with_counts ==========
-- Now includes comment_count. security_invoker ensures RLS applies (view runs as caller, not owner).
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
  COALESCE(c.comment_cnt, 0)::int AS comment_count
FROM highlights h
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS like_cnt
  FROM highlight_likes
  GROUP BY highlight_id
) l ON l.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS comment_cnt
  FROM highlight_comments
  GROUP BY highlight_id
) c ON c.hid = h.id;

GRANT SELECT ON public.highlights_with_counts TO authenticated;

-- ========== REALTIME (optional) ==========
-- Enable realtime for comments if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'highlight_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.highlight_comments;
  END IF;
END $$;
