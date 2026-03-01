-- Check-ins table and RPCs used by courts-api (getUserCheckIn, getTodayCheckInCount, checkInCourt, getCourtLeaderboard).

CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS check_ins_court_id_idx ON check_ins (court_id);
CREATE INDEX IF NOT EXISTS check_ins_user_id_idx ON check_ins (user_id);
CREATE INDEX IF NOT EXISTS check_ins_court_created_idx ON check_ins (court_id, created_at DESC);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Users can insert their own check-in only.
DROP POLICY IF EXISTS "check_ins_insert_own" ON check_ins;
CREATE POLICY "check_ins_insert_own"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read check_ins (for leaderboard and counts).
DROP POLICY IF EXISTS "check_ins_select_all" ON check_ins;
CREATE POLICY "check_ins_select_all"
  ON check_ins FOR SELECT
  TO authenticated
  USING (true);

-- RPC: check in at a court (insert row, return result).
CREATE OR REPLACE FUNCTION check_in(court_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_id uuid;
  last_ts timestamptz;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  INSERT INTO check_ins (court_id, user_id)
  VALUES (court_id_param, uid)
  RETURNING id, created_at INTO new_id, last_ts;
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Checked in',
    'last_check_in', last_ts,
    'check_in_id', new_id
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Court or user not found');
END;
$$;

-- RPC: leaderboard for a court (top users by check-in count).
CREATE OR REPLACE FUNCTION get_court_leaderboard(court_id_param uuid, limit_count int DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  total_check_ins bigint,
  rank bigint,
  last_check_in timestamptz,
  display_name text,
  username text
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
    p.username
  FROM agg a
  LEFT JOIN profiles p ON p.user_id = a.user_id
  ORDER BY a.rn
  LIMIT greatest(limit_count, 1);
$$;
