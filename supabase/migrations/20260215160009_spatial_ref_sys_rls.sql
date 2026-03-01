-- Enable RLS on PostGIS reference table spatial_ref_sys (read-only; satisfies Supabase linter).
-- spatial_ref_sys is a system lookup table; we allow SELECT only.
-- Only runs if the table exists in public (if PostGIS was moved to extensions, it may live there instead).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys'
  ) THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys_select_public" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_select_public" ON public.spatial_ref_sys
      FOR SELECT USING (true);
  END IF;
END
$$;
