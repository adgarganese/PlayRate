-- Highlights: view counts + comment replies (parent_id)
-- Safe to run after highlights + highlight_comments exist.

-- ========== HIGHLIGHT_VIEWS (view count per highlight) ==========
CREATE TABLE IF NOT EXISTS public.highlight_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlight_views_highlight
  ON public.highlight_views(highlight_id);

ALTER TABLE public.highlight_views ENABLE ROW LEVEL SECURITY;

-- Anyone who can read the highlight can insert a view (record view when opening)
DROP POLICY IF EXISTS "highlight_views_insert_authenticated" ON public.highlight_views;
CREATE POLICY "highlight_views_insert_authenticated"
  ON public.highlight_views FOR INSERT TO authenticated
  WITH CHECK (true);

-- Read: only for counting (view runs as caller via highlights_with_counts)
DROP POLICY IF EXISTS "highlight_views_select_authenticated" ON public.highlight_views;
CREATE POLICY "highlight_views_select_authenticated"
  ON public.highlight_views FOR SELECT TO authenticated
  USING (true);

-- ========== COMMENT REPLIES: parent_id on highlight_comments ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'highlight_comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.highlight_comments
      ADD COLUMN parent_id uuid REFERENCES public.highlight_comments(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_highlight_comments_parent
      ON public.highlight_comments(parent_id);
  END IF;
END $$;

-- ========== UPDATE VIEW: highlights_with_counts (add view_count) ==========
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
  COALESCE(v.view_cnt, 0)::int AS view_count
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
) c ON c.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS view_cnt
  FROM highlight_views
  GROUP BY highlight_id
) v ON v.hid = h.id;

GRANT SELECT ON public.highlights_with_counts TO authenticated;
