-- Beta: staff court edits + court_edit_suggestions. Check-ins do not grant edit rights.
-- 1) profiles.is_staff — set true in SQL for ops users only.
-- 2) auth_is_staff() — SECURITY DEFINER for RLS (works regardless of profiles SELECT policies).
-- 3) courts: extra UPDATE/DELETE policies for staff (creator policies unchanged).
-- 4) court_edit_suggestions: insert own row; select own + staff; staff can update (e.g. status).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_staff IS 'Beta: when true, may UPDATE/DELETE any court via RLS.';

CREATE OR REPLACE FUNCTION public.auth_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_staff FROM public.profiles p WHERE p.user_id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_staff() TO authenticated;

-- Staff may update any court (OR with existing creator-only policy).
DROP POLICY IF EXISTS "courts_update_staff" ON public.courts;
CREATE POLICY "courts_update_staff" ON public.courts
  FOR UPDATE TO authenticated
  USING (public.auth_is_staff())
  WITH CHECK (public.auth_is_staff());

-- Staff delete for moderation (creator-only delete policy remains).
DROP POLICY IF EXISTS "courts_delete_staff" ON public.courts;
CREATE POLICY "courts_delete_staff" ON public.courts
  FOR DELETE TO authenticated
  USING (public.auth_is_staff());

CREATE TABLE IF NOT EXISTS public.court_edit_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS court_edit_suggestions_court_id_idx ON public.court_edit_suggestions(court_id);
CREATE INDEX IF NOT EXISTS court_edit_suggestions_suggested_by_idx ON public.court_edit_suggestions(suggested_by);
CREATE INDEX IF NOT EXISTS court_edit_suggestions_status_idx ON public.court_edit_suggestions(status);

ALTER TABLE public.court_edit_suggestions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.court_edit_suggestions TO authenticated;

DROP POLICY IF EXISTS "court_edit_suggestions_insert_own" ON public.court_edit_suggestions;
CREATE POLICY "court_edit_suggestions_insert_own" ON public.court_edit_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

DROP POLICY IF EXISTS "court_edit_suggestions_select_own_or_staff" ON public.court_edit_suggestions;
CREATE POLICY "court_edit_suggestions_select_own_or_staff" ON public.court_edit_suggestions
  FOR SELECT TO authenticated
  USING (auth.uid() = suggested_by OR public.auth_is_staff());

DROP POLICY IF EXISTS "court_edit_suggestions_update_staff" ON public.court_edit_suggestions;
CREATE POLICY "court_edit_suggestions_update_staff" ON public.court_edit_suggestions
  FOR UPDATE TO authenticated
  USING (public.auth_is_staff())
  WITH CHECK (public.auth_is_staff());
