-- Court junction + comments + ratings + photos + RPC/view used by lib/courts-api.ts and lib/courts-recommendations.ts.
-- Extends public.courts with optional detail columns used by fetchCourtById / new court form.

ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS hoop_count integer;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS court_type text;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS surface_type text;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS has_lights boolean;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS cost text;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS hours text;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS parking_type text;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS notes text;

-- ---------------------------------------------------------------------------
-- court_sports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_sports (
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (court_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_court_sports_sport_id ON public.court_sports(sport_id);

-- ---------------------------------------------------------------------------
-- court_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_comments_court_id ON public.court_comments(court_id);

-- ---------------------------------------------------------------------------
-- court_ratings + stats view + RPC (from court-ratings-migration.sql, idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_ratings_court_user_unique UNIQUE (court_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_court_ratings_court_id ON public.court_ratings(court_id);
CREATE INDEX IF NOT EXISTS idx_court_ratings_user_id ON public.court_ratings(user_id);

CREATE OR REPLACE FUNCTION public.update_court_rating_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_court_rating_timestamp ON public.court_ratings;
CREATE TRIGGER trigger_update_court_rating_timestamp
  BEFORE UPDATE ON public.court_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_court_rating_updated_at();

CREATE OR REPLACE VIEW public.court_rating_stats WITH (security_invoker = true) AS
SELECT
  court_id,
  COUNT(*) AS rating_count,
  ROUND(AVG(rating)::numeric, 1) AS average_rating
FROM public.court_ratings
GROUP BY court_id;

CREATE OR REPLACE FUNCTION public.get_court_rating_info(
  court_id_param uuid,
  user_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  average_rating numeric,
  rating_count bigint,
  user_rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*)::bigint AS rating_count,
      CASE
        WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::numeric, 1)
        ELSE 0::numeric
      END AS average_rating
    FROM public.court_ratings
    WHERE court_id = court_id_param
  ),
  user_rating_row AS (
    SELECT r.rating
    FROM public.court_ratings r
    WHERE r.court_id = court_id_param
      AND user_id_param IS NOT NULL
      AND r.user_id = user_id_param
    LIMIT 1
  )
  SELECT
    stats.average_rating,
    stats.rating_count,
    user_rating_row.rating::integer AS user_rating
  FROM stats
  LEFT JOIN user_rating_row ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_court_rating_info(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_court_rating_info(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- court_photos (metadata for storage.objects in bucket court-photos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 1 AND slot <= 4),
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_photos_court_slot_unique UNIQUE (court_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_court_photos_court_id ON public.court_photos(court_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.court_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_sports_select_public" ON public.court_sports;
CREATE POLICY "court_sports_select_public"
  ON public.court_sports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "court_sports_insert_authenticated" ON public.court_sports;
CREATE POLICY "court_sports_insert_authenticated"
  ON public.court_sports FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "court_comments_select_public" ON public.court_comments;
CREATE POLICY "court_comments_select_public"
  ON public.court_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "court_comments_insert_own" ON public.court_comments;
CREATE POLICY "court_comments_insert_own"
  ON public.court_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_ratings_select_public" ON public.court_ratings;
CREATE POLICY "court_ratings_select_public"
  ON public.court_ratings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "court_ratings_insert_own" ON public.court_ratings;
CREATE POLICY "court_ratings_insert_own"
  ON public.court_ratings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "court_ratings_update_own" ON public.court_ratings;
CREATE POLICY "court_ratings_update_own"
  ON public.court_ratings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "court_ratings_delete_own" ON public.court_ratings;
CREATE POLICY "court_ratings_delete_own"
  ON public.court_ratings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "court_photos_select_public" ON public.court_photos;
CREATE POLICY "court_photos_select_public"
  ON public.court_photos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "court_photos_insert_own" ON public.court_photos;
CREATE POLICY "court_photos_insert_own"
  ON public.court_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_photos_update_own" ON public.court_photos;
CREATE POLICY "court_photos_update_own"
  ON public.court_photos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_photos_delete_own" ON public.court_photos;
CREATE POLICY "court_photos_delete_own"
  ON public.court_photos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.court_sports TO authenticated;
GRANT SELECT, INSERT ON public.court_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_photos TO authenticated;
GRANT SELECT ON public.court_rating_stats TO authenticated;
