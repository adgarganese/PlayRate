-- Migration: recompute_rep function and trigger on cosigns INSERT

-- ============================================
-- 1) recompute_rep(p_user_id uuid)
-- ============================================
CREATE OR REPLACE FUNCTION recompute_rep(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_by_attr JSONB;
  v_level INT;
BEGIN
  -- Total cosigns received
  SELECT COUNT(*)::INT INTO v_total
  FROM cosigns
  WHERE to_user_id = p_user_id;

  -- Cosigns by attribute (attribute -> count)
  SELECT COALESCE(
    jsonb_object_agg(attribute, cnt),
    '{}'::jsonb
  ) INTO v_by_attr
  FROM (
    SELECT attribute, COUNT(*)::INT AS cnt
    FROM cosigns
    WHERE to_user_id = p_user_id
    GROUP BY attribute
  ) t;

  -- Rep level from total: 1=0-4, 2=5-14, 3=15-29, 4=30-49, 5=50-79, 6=80+
  v_level := CASE
    WHEN v_total >= 80 THEN 6
    WHEN v_total >= 50 THEN 5
    WHEN v_total >= 30 THEN 4
    WHEN v_total >= 15 THEN 3
    WHEN v_total >= 5  THEN 2
    ELSE 1
  END;

  -- Upsert rep_rollups
  INSERT INTO rep_rollups (user_id, total_cosigns, cosigns_by_attribute, rep_level, updated_at)
  VALUES (p_user_id, v_total, COALESCE(v_by_attr, '{}'::jsonb), v_level, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_cosigns = EXCLUDED.total_cosigns,
    cosigns_by_attribute = EXCLUDED.cosigns_by_attribute,
    rep_level = EXCLUDED.rep_level,
    updated_at = EXCLUDED.updated_at;

  -- Update profiles.rep_level if column exists (no-op if column missing, e.g. migration 1 not run)
  BEGIN
    UPDATE profiles
    SET rep_level = v_level
    WHERE user_id = p_user_id;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    NULL;
  END;
END;
$$;

-- ============================================
-- 2) Wrapper for trigger (returns TRIGGER)
-- ============================================
CREATE OR REPLACE FUNCTION cosigns_recompute_rep_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM recompute_rep(NEW.to_user_id);
  RETURN NEW;
END;
$$;

-- ============================================
-- 3) Trigger on cosigns INSERT
-- ============================================
DROP TRIGGER IF EXISTS cosigns_recompute_rep_trigger ON cosigns;

CREATE TRIGGER cosigns_recompute_rep_trigger
  AFTER INSERT ON cosigns
  FOR EACH ROW
  EXECUTE FUNCTION cosigns_recompute_rep_trigger_fn();