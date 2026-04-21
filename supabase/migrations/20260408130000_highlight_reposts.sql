-- Highlight reposts: reference rows (not copies). One repost per user per highlight.
-- Run after public.highlights exists.

-- ========== TABLE ==========
CREATE TABLE IF NOT EXISTS public.highlight_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT highlight_reposts_highlight_user_unique UNIQUE (highlight_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_reposts_user_id
  ON public.highlight_reposts(user_id);

CREATE INDEX IF NOT EXISTS idx_highlight_reposts_highlight_id
  ON public.highlight_reposts(highlight_id);

CREATE INDEX IF NOT EXISTS idx_highlight_reposts_created_at
  ON public.highlight_reposts(created_at DESC);

ALTER TABLE public.highlight_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view reposts" ON public.highlight_reposts;
CREATE POLICY "Authenticated users can view reposts"
  ON public.highlight_reposts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create own reposts" ON public.highlight_reposts;
CREATE POLICY "Users can create own reposts"
  ON public.highlight_reposts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own reposts" ON public.highlight_reposts;
CREATE POLICY "Users can delete own reposts"
  ON public.highlight_reposts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.highlight_reposts TO authenticated;

-- ========== VIEW: highlights_with_counts + repost_count ==========
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
) v ON v.hid = h.id
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS repost_cnt
  FROM highlight_reposts
  GROUP BY highlight_id
) r ON r.hid = h.id;

GRANT SELECT ON public.highlights_with_counts TO authenticated;

-- ========== NOTIFICATION: repost (notify highlight owner; skip self-repost) ==========
CREATE OR REPLACE FUNCTION public.notify_on_highlight_repost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  actor_name text;
BEGIN
  SELECT user_id INTO owner_id FROM public.highlights WHERE id = NEW.highlight_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;
  PERFORM public.create_notification(
    owner_id,
    NEW.user_id,
    'repost',
    'highlight',
    NEW.highlight_id,
    COALESCE(actor_name, 'Someone') || ' reposted your highlight',
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_highlight_repost ON public.highlight_reposts;
CREATE TRIGGER trigger_notify_on_highlight_repost
  AFTER INSERT ON public.highlight_reposts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_highlight_repost();
