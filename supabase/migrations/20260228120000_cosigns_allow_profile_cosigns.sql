-- Allow profile cosigns (no run context): run_id nullable + RLS for insert when run_id IS NULL.
-- Existing run-scoped cosigns keep run_id NOT NULL; profile cosigns use run_id NULL.

-- 1) Make run_id nullable (keep FK; NULL means profile cosign)
ALTER TABLE cosigns
  ALTER COLUMN run_id DROP NOT NULL;

-- 2) Allow one profile cosign per (from_user_id, to_user_id, attribute) when run_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS cosigns_profile_unique
  ON cosigns (from_user_id, to_user_id, attribute)
  WHERE run_id IS NULL;

-- 3) RLS: allow INSERT when run_id IS NULL (profile cosign) - authenticated, no self, no run checks
DROP POLICY IF EXISTS "cosigns_insert_authenticated_participants" ON cosigns;
DROP POLICY IF EXISTS "cosigns_insert_run_scoped" ON cosigns;
DROP POLICY IF EXISTS "cosigns_insert_profile_scoped" ON cosigns;
CREATE POLICY "cosigns_insert_run_scoped"
  ON cosigns FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id != to_user_id
    AND run_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM runs r WHERE r.id = run_id AND (r.ends_at < now() OR r.status = 'completed'))
    AND EXISTS (SELECT 1 FROM run_participants rp WHERE rp.run_id = cosigns.run_id AND rp.user_id = cosigns.from_user_id)
    AND EXISTS (SELECT 1 FROM run_participants rp WHERE rp.run_id = cosigns.run_id AND rp.user_id = cosigns.to_user_id)
  );

CREATE POLICY "cosigns_insert_profile_scoped"
  ON cosigns FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id != to_user_id
    AND run_id IS NULL
  );
