-- Tighten courts INSERT/UPDATE/DELETE RLS: only the court creator (resolve Supabase "overly permissive" warning).
-- Table public.courts has created_by uuid REFERENCES auth.users(id).

DROP POLICY IF EXISTS "courts_insert_authenticated" ON public.courts;
CREATE POLICY "courts_insert_authenticated" ON public.courts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "courts_update_authenticated" ON public.courts;
CREATE POLICY "courts_update_authenticated" ON public.courts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "courts_delete_authenticated" ON public.courts;
CREATE POLICY "courts_delete_authenticated" ON public.courts
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
