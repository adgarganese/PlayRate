-- Enforce 30-day cooldown for profile cosigns: same viewer can cosign same attribute for same player again after 30 days.
-- Drop the "one profile cosign per (from, to, attribute) ever" unique index and enforce cooldown in RLS.

-- 1) Allow multiple profile cosigns per (from, to, attribute) but only one per 30-day window
DROP INDEX IF EXISTS cosigns_profile_unique;

-- 2) Replace profile insert policy: allow insert only when no existing cosign (same from, to, attribute, run_id NULL) in last 30 days
DROP POLICY IF EXISTS "cosigns_insert_profile_scoped" ON cosigns;
CREATE POLICY "cosigns_insert_profile_scoped"
  ON cosigns FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id != to_user_id
    AND run_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM cosigns c2
      WHERE c2.from_user_id = cosigns.from_user_id
        AND c2.to_user_id = cosigns.to_user_id
        AND c2.attribute = cosigns.attribute
        AND c2.run_id IS NULL
        AND c2.created_at > now() - interval '30 days'
    )
  );
