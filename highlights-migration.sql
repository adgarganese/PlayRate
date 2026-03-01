-- Highlights and highlight_likes tables migration
-- Run in Supabase SQL Editor

-- Storage bucket (create if not exists - run in Supabase Dashboard > Storage if needed)
-- Bucket name: highlights, public

-- TABLE: public.highlights
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

-- TABLE: public.highlight_likes
CREATE TABLE IF NOT EXISTS public.highlight_likes (
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (highlight_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_highlight_likes_highlight ON public.highlight_likes(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_likes_user ON public.highlight_likes(user_id);

-- RLS: highlights
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read public or own highlights"
  ON public.highlights FOR SELECT
  TO authenticated
  USING (is_public = true OR user_id = (select auth.uid()));

CREATE POLICY "Users insert own highlights"
  ON public.highlights FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users update own highlights"
  ON public.highlights FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users delete own highlights"
  ON public.highlights FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- RLS: highlight_likes
ALTER TABLE public.highlight_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read likes"
  ON public.highlight_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own likes"
  ON public.highlight_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users delete own likes"
  ON public.highlight_likes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- View: highlights with like_count (avoids N+1). security_invoker ensures RLS applies.
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
  COALESCE(l.cnt, 0)::int AS like_count
FROM highlights h
LEFT JOIN (
  SELECT highlight_id AS hid, COUNT(*)::bigint AS cnt
  FROM highlight_likes
  GROUP BY highlight_id
) l ON l.hid = h.id;

GRANT SELECT ON public.highlights_with_counts TO authenticated;

-- Note: Create storage bucket "highlights" in Supabase Dashboard > Storage (public)
