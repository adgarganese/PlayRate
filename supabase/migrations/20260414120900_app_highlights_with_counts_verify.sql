-- Final guarantee: public.highlights_with_counts exists with the repost-aware column set expected by lib/highlights.ts
-- (id, user_id, sport, media_type, media_url, thumbnail_url, caption, location_name, latitude, longitude,
--  created_at, is_public, like_count, comment_count, view_count, repost_count).
--
-- Recreates the view when it is missing OR when any expected column is missing (e.g. older view before repost_count).

DO $$
DECLARE
  deps_ok boolean;
  view_exists boolean;
  col_count int;
BEGIN
  deps_ok :=
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'highlights')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'highlight_likes')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'highlight_comments')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'highlight_views')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'highlight_reposts');

  IF NOT deps_ok THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'highlights_with_counts'
  ) INTO view_exists;

  SELECT count(*)::int INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'highlights_with_counts'
    AND column_name IN (
      'id', 'user_id', 'sport', 'media_type', 'media_url', 'thumbnail_url', 'caption',
      'location_name', 'latitude', 'longitude', 'created_at', 'is_public',
      'like_count', 'comment_count', 'view_count', 'repost_count'
    );

  IF view_exists AND col_count = 16 THEN
    RETURN;
  END IF;

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
END $$;
