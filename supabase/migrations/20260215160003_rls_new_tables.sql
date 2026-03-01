-- Migration: RLS for new tables only (courts, runs, run_participants, cosigns, rep_rollups, court_follows, notification_prefs)
-- Enables RLS and creates explicit per-operation policies. Idempotent: drops then recreates these policy names.

-- ============================================
-- COURTS
-- ============================================
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courts_select_public" ON courts;
-- SELECT: public (anyone)
CREATE POLICY "courts_select_public"
  ON courts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "courts_insert_authenticated" ON courts;
-- INSERT: authenticated only
CREATE POLICY "courts_insert_authenticated"
  ON courts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE/DELETE: not granted (no policy = deny; future: restrict to creator/admin)

-- ============================================
-- RUNS
-- ============================================
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runs_select_public" ON runs;
-- SELECT: public
CREATE POLICY "runs_select_public"
  ON runs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "runs_insert_creator" ON runs;
-- INSERT: authenticated, creator_id must equal auth.uid()
CREATE POLICY "runs_insert_creator"
  ON runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "runs_update_creator" ON runs;
-- UPDATE: only creator
CREATE POLICY "runs_update_creator"
  ON runs FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "runs_delete_creator" ON runs;
-- DELETE: only creator
CREATE POLICY "runs_delete_creator"
  ON runs FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- ============================================
-- RUN_PARTICIPANTS
-- ============================================
ALTER TABLE run_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "run_participants_select_public" ON run_participants;
-- SELECT: public (anyone can see participants for a run)
CREATE POLICY "run_participants_select_public"
  ON run_participants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "run_participants_insert_own" ON run_participants;
-- INSERT: authenticated, user_id must equal auth.uid()
CREATE POLICY "run_participants_insert_own"
  ON run_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "run_participants_update_own" ON run_participants;
-- UPDATE: authenticated, only on own row
CREATE POLICY "run_participants_update_own"
  ON run_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "run_participants_delete_own" ON run_participants;
-- DELETE: authenticated, only on own row
CREATE POLICY "run_participants_delete_own"
  ON run_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- COSIGNS
-- ============================================
ALTER TABLE cosigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cosigns_select_participants" ON cosigns;
-- SELECT: only sender or recipient can see the row
CREATE POLICY "cosigns_select_participants"
  ON cosigns FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "cosigns_insert_authenticated_participants" ON cosigns;
-- INSERT: authenticated, from_user_id = auth.uid(), run exists and ended/completed, both users are participants
CREATE POLICY "cosigns_insert_authenticated_participants"
  ON cosigns FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id != to_user_id
    AND EXISTS (
      SELECT 1 FROM runs r
      WHERE r.id = run_id
        AND (r.ends_at < now() OR r.status = 'completed')
    )
    AND EXISTS (
      SELECT 1 FROM run_participants rp
      WHERE rp.run_id = cosigns.run_id AND rp.user_id = cosigns.from_user_id
    )
    AND EXISTS (
      SELECT 1 FROM run_participants rp
      WHERE rp.run_id = cosigns.run_id AND rp.user_id = cosigns.to_user_id
    )
  );

-- UPDATE/DELETE: no policy (immutable; service role only if needed)

-- ============================================
-- REP_ROLLUPS
-- ============================================
ALTER TABLE rep_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep_rollups_select_public" ON rep_rollups;
-- SELECT: public (read-only for clients)
CREATE POLICY "rep_rollups_select_public"
  ON rep_rollups FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE: no policy (service role only)

-- ============================================
-- COURT_FOLLOWS
-- ============================================
ALTER TABLE court_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_follows_select_own" ON court_follows;
-- SELECT: authenticated, user sees only their follows
CREATE POLICY "court_follows_select_own"
  ON court_follows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_follows_insert_own" ON court_follows;
-- INSERT: only for own user_id
CREATE POLICY "court_follows_insert_own"
  ON court_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_follows_delete_own" ON court_follows;
-- DELETE: only own row
CREATE POLICY "court_follows_delete_own"
  ON court_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- NOTIFICATION_PREFS
-- ============================================
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_prefs_select_own" ON notification_prefs;
-- SELECT: only own row
CREATE POLICY "notification_prefs_select_own"
  ON notification_prefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_prefs_insert_own" ON notification_prefs;
-- INSERT: only own user_id
CREATE POLICY "notification_prefs_insert_own"
  ON notification_prefs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_prefs_update_own" ON notification_prefs;
-- UPDATE: only own row
CREATE POLICY "notification_prefs_update_own"
  ON notification_prefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_prefs_delete_own" ON notification_prefs;
-- DELETE: only own row
CREATE POLICY "notification_prefs_delete_own"
  ON notification_prefs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
