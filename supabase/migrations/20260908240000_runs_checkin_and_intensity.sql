-- Runs ↔ check-in: a check-in is "I am at this court now." A run is who is
-- playing. check_ins.run_id is optional so you can be here without a session.
--
-- Intensity: Shootaround / Casual / Competitive / Elite. Keep `balanced` in the
-- CHECK so TestFlight 29's Schedule run insert still succeeds.
--
-- APPLY VIA SQL EDITOR. Additive; 29 does not send run_id or new skill_band
-- values. Do not drop `balanced` until 29 is retired.

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS check_ins_run_id_idx ON public.check_ins (run_id)
  WHERE run_id IS NOT NULL;

ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_skill_band_check;
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'runs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%skill_band%'
  LOOP
    EXECUTE format('ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;
ALTER TABLE public.runs ADD CONSTRAINT runs_skill_band_check
  CHECK (skill_band IN ('shootaround', 'casual', 'balanced', 'competitive', 'elite'));

CREATE OR REPLACE FUNCTION public.link_check_in_run(p_court_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  updated int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF p_court_id IS NULL OR p_run_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing court or run');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.runs r
    WHERE r.id = p_run_id AND r.court_id = p_court_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Run is not at this court');
  END IF;

  UPDATE public.check_ins c
  SET run_id = p_run_id
  WHERE c.user_id = uid
    AND c.court_id = p_court_id
    AND (timezone('utc', c.created_at))::date = (timezone('utc', now()))::date
    AND c.run_id IS DISTINCT FROM p_run_id;

  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated', updated
  );
END;
$$;

ALTER FUNCTION public.link_check_in_run(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.link_check_in_run(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_check_in_run(uuid, uuid) TO authenticated;
