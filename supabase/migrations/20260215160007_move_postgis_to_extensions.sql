-- Move PostGIS (and pgcrypto) out of public schema to satisfy Supabase "extension in public" warning.
-- Uses relocatable flag + SET SCHEMA for PostGIS (required for PostGIS 2.3+).
-- RPC courts_nearby is recreated with search_path including extensions so PostGIS functions resolve.

-- ============================================
-- 1) Create extensions schema
-- ============================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- ============================================
-- 2) Move PostGIS to extensions (relocatable required for 2.3+)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    UPDATE pg_extension SET extrelocatable = true WHERE extname = 'postgis';
    ALTER EXTENSION postgis SET SCHEMA extensions;
    -- Dummy version bump so we can run UPDATE (extension system disallows same-to-same).
    -- If this fails on your PostGIS version, run in SQL Editor: ALTER EXTENSION postgis UPDATE TO '<yourversion>next'; ALTER EXTENSION postgis UPDATE;
    BEGIN
      ALTER EXTENSION postgis UPDATE TO "3.4.3next";
      ALTER EXTENSION postgis UPDATE;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Extension is already in extensions schema; reset relocatable and continue
    END;
    UPDATE pg_extension SET extrelocatable = false WHERE extname = 'postgis';
  END IF;
END
$$;

-- ============================================
-- 3) Move pgcrypto to extensions (if in public)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;
END
$$;

-- ============================================
-- 4) Ensure extensions schema is usable
-- ============================================
GRANT USAGE ON SCHEMA extensions TO public;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- ============================================
-- 5) Recreate courts_nearby with search_path so PostGIS functions resolve
-- ============================================
CREATE OR REPLACE FUNCTION public.courts_nearby(
  p_lat numeric,
  p_lng numeric,
  p_radius_meters int DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat numeric,
  lng numeric,
  distance_meters double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.name,
    c.address,
    c.lat,
    c.lng,
    ST_Distance(
      c.location_geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_meters
  FROM courts c
  WHERE c.location_geom IS NOT NULL
    AND ST_DWithin(
      c.location_geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters ASC;
$$;
