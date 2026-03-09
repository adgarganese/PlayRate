-- public.spatial_ref_sys: "RLS has not been enabled" (PostGIS system table)
-- Run in Supabase Dashboard → SQL Editor.
--
-- You cannot enable RLS on this table (must be owner – it's owned by PostGIS).
-- Revoking access is good practice but does NOT remove the Security Advisor
-- warning; the advisor only checks "table in public + RLS disabled".

-- ---------------------------------------------------------------------------
-- 1. Revoke API access (recommended – limits who can read the table)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.spatial_ref_sys FROM anon;
REVOKE ALL ON public.spatial_ref_sys FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. The warning will still appear – what to do
-- ---------------------------------------------------------------------------
-- The Security Advisor (check 0013 "rls disabled in public") has no way to
-- exclude a single table you don't own. So the warning will remain.
--
-- Safe to ignore because:
-- - spatial_ref_sys is a read-only PostGIS reference table (coordinate systems).
-- - Your app does not query it. Risk is negligible.
--
-- To get rid of the warning you would need Supabase to either:
-- - Run as superuser: ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
--   then: CREATE POLICY "allow read" ON public.spatial_ref_sys FOR SELECT TO public USING (true);
-- - Or add PostGIS system tables (e.g. spatial_ref_sys) to the advisor's exclusion list.
-- Open a support request at https://supabase.com/dashboard/support and ask for one of the above.
