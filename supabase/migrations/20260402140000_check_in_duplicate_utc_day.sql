-- One check-in per user per court per UTC calendar day (DB-enforced + RPC messaging).
-- Deduplicate legacy rows so the unique index can be created safely.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        user_id,
        court_id,
        (timezone('utc', created_at))::date
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM check_ins
)
DELETE FROM check_ins c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS check_ins_one_per_user_court_utc_day
ON public.check_ins (
  user_id,
  court_id,
  ((timezone('utc', created_at))::date)
);

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

  IF EXISTS (
    SELECT 1
    FROM check_ins c
    WHERE c.user_id = uid
      AND c.court_id = court_id_param
      AND (timezone('utc', c.created_at))::date = (timezone('utc', now()))::date
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already checked in at this court today.'
    );
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
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already checked in at this court today.'
    );
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Court or user not found');
END;
$$;
