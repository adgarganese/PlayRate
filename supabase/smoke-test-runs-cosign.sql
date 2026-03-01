-- =============================================================================
-- Smoke test: runs → run_participants → cosigns → rep_rollups (trigger)
-- =============================================================================
-- Run this in Supabase SQL Editor after all migrations. No psql meta-commands.
--
-- Prerequisites:
--   - At least 2 rows in public.profiles (uses two most recent by created_at).
--   - If fewer than 2 profiles exist, the script raises an exception with instructions.
--
-- What it does:
--   1) Picks two profile user_ids (USER_A, USER_B) from existing profiles.
--   2) Inserts a test court, then a completed run (creator = USER_A).
--   3) Inserts run_participants for USER_A and USER_B.
--   4) Inserts one cosign from USER_A → USER_B (triggers recompute_rep for USER_B).
--   5) Verifies cosign row and rep_rollups for USER_B; prints PASS/FAIL.
--   6) Deletes only the court, run, participants, and cosign created by this script.
-- =============================================================================

DO $$
DECLARE
  v_user_a    uuid;
  v_user_b    uuid;
  v_court_id  uuid;
  v_run_id    uuid;
  v_cosign_id uuid;
  v_total     int;
  v_pass      boolean;
BEGIN
  -- 1) Pick two distinct profile user_ids (most recent two)
  SELECT user_id INTO v_user_a
  FROM profiles
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1 OFFSET 0;

  SELECT user_id INTO v_user_b
  FROM profiles
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1 OFFSET 1;

  IF v_user_a IS NULL OR v_user_b IS NULL OR v_user_a = v_user_b THEN
    RAISE EXCEPTION 'Smoke test requires at least 2 distinct profiles. Create more users (e.g. sign up) and run again.'
      USING HINT = 'profiles are created when users sign up; ensure public.profiles has at least 2 rows.';
  END IF;

  -- 2) Insert court (lat/lng); location_geom is generated
  INSERT INTO courts (name, address, lat, lng)
  VALUES ('Smoke Test Court', '123 Test St', 40.7128, -74.0060)
  RETURNING id INTO v_court_id;

  -- 3) Insert run: ended in the past, status completed (satisfies cosign eligibility)
  INSERT INTO runs (
    court_id,
    creator_id,
    starts_at,
    ends_at,
    skill_band,
    capacity,
    status
  )
  VALUES (
    v_court_id,
    v_user_a,
    now() - interval '2 hours',
    now() - interval '1 hour',
    'casual',
    10,
    'completed'
  )
  RETURNING id INTO v_run_id;

  -- 4) Insert run_participants (both users joined)
  INSERT INTO run_participants (run_id, user_id, join_status)
  VALUES
    (v_run_id, v_user_a, 'joined'),
    (v_run_id, v_user_b, 'joined');

  -- 5) Insert cosign from USER_A → USER_B (triggers recompute_rep for USER_B)
  INSERT INTO cosigns (from_user_id, to_user_id, run_id, attribute, note)
  VALUES (v_user_a, v_user_b, v_run_id, 'iq', 'Smoke test cosign.')
  RETURNING id INTO v_cosign_id;

  -- 6) Verification: rep_rollups for USER_B (updated by trigger)
  SELECT total_cosigns INTO v_total
  FROM rep_rollups
  WHERE user_id = v_user_b;

  v_pass := (v_total IS NOT NULL AND v_total >= 1);

  RAISE NOTICE '--- Smoke test verification ---';
  RAISE NOTICE 'Cosign id: %', v_cosign_id;
  RAISE NOTICE 'rep_rollups for USER_B: total_cosigns = %', COALESCE(v_total::text, 'NULL');
  RAISE NOTICE 'Result: %', CASE WHEN v_pass THEN 'PASS' ELSE 'FAIL' END;

  IF NOT v_pass THEN
    RAISE EXCEPTION 'Smoke test FAIL: rep_rollups total_cosigns for USER_B should be >= 1.';
  END IF;

  -- 7) Cleanup (only records created in this script)
  DELETE FROM cosigns    WHERE id = v_cosign_id;
  DELETE FROM run_participants WHERE run_id = v_run_id;
  DELETE FROM runs       WHERE id = v_run_id;
  DELETE FROM courts     WHERE id = v_court_id;

  RAISE NOTICE 'Cleanup done. Smoke test completed successfully.';
END
$$;
