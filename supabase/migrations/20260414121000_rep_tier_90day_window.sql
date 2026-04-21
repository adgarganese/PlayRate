-- 90-day rolling cosign reputation + named tiers (Bronze → Diamond).
-- rep_rollups.total_cosigns / cosigns_by_attribute / profiles.rep_level align with app lib/tiers.ts.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Migrate rep_level from legacy integer (1–6) to tier name (text)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rep_rollups
  ALTER COLUMN rep_level DROP DEFAULT;

ALTER TABLE public.rep_rollups
  ALTER COLUMN rep_level TYPE TEXT USING (
    CASE rep_level::integer
      WHEN 1 THEN 'Unranked'
      WHEN 2 THEN 'Bronze'
      WHEN 3 THEN 'Silver'
      WHEN 4 THEN 'Gold'
      WHEN 5 THEN 'Platinum'
      WHEN 6 THEN 'Diamond'
      ELSE 'Unranked'
    END
  );

ALTER TABLE public.rep_rollups
  ALTER COLUMN rep_level SET DEFAULT 'Unranked';

ALTER TABLE public.profiles
  ALTER COLUMN rep_level DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN rep_level TYPE TEXT USING (
    CASE rep_level::integer
      WHEN 1 THEN 'Unranked'
      WHEN 2 THEN 'Bronze'
      WHEN 3 THEN 'Silver'
      WHEN 4 THEN 'Gold'
      WHEN 5 THEN 'Platinum'
      WHEN 6 THEN 'Diamond'
      ELSE 'Unranked'
    END
  );

ALTER TABLE public.profiles
  ALTER COLUMN rep_level SET DEFAULT 'Unranked';

-- ---------------------------------------------------------------------------
-- 2) recompute_rep: 90-day window + tier thresholds (matches client)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_rep(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_by_attr JSONB;
  v_tier TEXT;
BEGIN
  SELECT COUNT(*)::INT INTO v_total
  FROM cosigns
  WHERE to_user_id = p_user_id
    AND created_at >= (now() - interval '90 days');

  SELECT COALESCE(
    jsonb_object_agg(attribute, cnt),
    '{}'::jsonb
  ) INTO v_by_attr
  FROM (
    SELECT attribute, COUNT(*)::INT AS cnt
    FROM cosigns
    WHERE to_user_id = p_user_id
      AND created_at >= (now() - interval '90 days')
    GROUP BY attribute
  ) t;

  v_tier := CASE
    WHEN v_total >= 150 THEN 'Diamond'
    WHEN v_total >= 75 THEN 'Platinum'
    WHEN v_total >= 35 THEN 'Gold'
    WHEN v_total >= 15 THEN 'Silver'
    WHEN v_total >= 5 THEN 'Bronze'
    ELSE 'Unranked'
  END;

  INSERT INTO rep_rollups (user_id, total_cosigns, cosigns_by_attribute, rep_level, updated_at)
  VALUES (p_user_id, v_total, COALESCE(v_by_attr, '{}'::jsonb), v_tier, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_cosigns = EXCLUDED.total_cosigns,
    cosigns_by_attribute = EXCLUDED.cosigns_by_attribute,
    rep_level = EXCLUDED.rep_level,
    updated_at = EXCLUDED.updated_at;

  BEGIN
    UPDATE profiles
    SET rep_level = v_tier
    WHERE user_id = p_user_id;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    NULL;
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Court leaderboard: expose viewer rep tier for UI badges
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_court_leaderboard(court_id_param uuid, limit_count int DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  total_check_ins bigint,
  rank bigint,
  last_check_in timestamptz,
  display_name text,
  username text,
  rep_level text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      c.user_id,
      count(*)::bigint AS total_check_ins,
      max(c.created_at) AS last_check_in,
      row_number() OVER (ORDER BY count(*) DESC, max(c.created_at) DESC) AS rn
    FROM check_ins c
    WHERE c.court_id = court_id_param
    GROUP BY c.user_id
  )
  SELECT
    a.user_id,
    a.total_check_ins,
    a.rn AS rank,
    a.last_check_in,
    p.name AS display_name,
    p.username,
    COALESCE(p.rep_level::text, 'Unranked') AS rep_level
  FROM agg a
  LEFT JOIN profiles p ON p.user_id = a.user_id
  ORDER BY a.rn
  LIMIT greatest(limit_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- 4) Backfill rollups + profile rep_level for users with cosigns or rollups
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id FROM rep_rollups
    UNION
    SELECT DISTINCT to_user_id AS user_id FROM cosigns
  LOOP
    PERFORM public.recompute_rep(r.user_id);
  END LOOP;
END $$;

COMMIT;
