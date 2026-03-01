-- PostGIS + courts location: extensions, lat/lng + generated geometry, indexes, courts_nearby RPC.
-- Courts table is created in 000; this migration upgrades it with location_geom, amenities, indexes, RPC, RLS.
-- No ALTER EXTENSION ... SET SCHEMA. Non-destructive; uses IF NOT EXISTS and conditional DDL.

-- ============================================
-- 1) EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 2) COURTS SCHEMA (ALTER only; table created in 000)
-- ============================================
-- Use "location_geom" as the single stable generated geometry column (avoids RPC/TS ambiguity).
-- Courts may already have location (geography) from 000; we do NOT drop it.

ALTER TABLE courts ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 8);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS lng NUMERIC(11, 8);

-- Add generated geometry column only if missing (existing DB may have geography "location"; we keep it and add location_geom)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courts' AND column_name = 'location_geom'
  ) THEN
    ALTER TABLE courts ADD COLUMN location_geom geometry(Point, 4326)
      GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED;
  END IF;
END
$$;

-- Ensure indoor and amenities exist (from 20260215160000)
ALTER TABLE courts ADD COLUMN IF NOT EXISTS indoor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================
-- 3) SPATIAL + BTREE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS courts_lat_lng_idx ON courts (lat, lng);
CREATE INDEX IF NOT EXISTS courts_location_gix ON courts USING gist (location_geom);

-- ============================================
-- 4) RPC: courts_nearby (for later use)
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
SET search_path = public
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

-- ============================================
-- 5) RLS (idempotent)
-- ============================================
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courts_select_public" ON courts;
CREATE POLICY "courts_select_public" ON courts FOR SELECT USING (true);

DROP POLICY IF EXISTS "courts_insert_authenticated" ON courts;
CREATE POLICY "courts_insert_authenticated" ON courts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "courts_update_authenticated" ON courts;
CREATE POLICY "courts_update_authenticated" ON courts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "courts_delete_authenticated" ON courts;
CREATE POLICY "courts_delete_authenticated" ON courts FOR DELETE TO authenticated USING (true);

-- ============================================
-- 6) SMOKE TEST (run manually in SQL Editor if desired)
-- ============================================
/*
-- Insert a sample court with lat/lng:
INSERT INTO courts (name, address, lat, lng)
VALUES ('Smoke Test Court', '123 Test St', 40.7128, -74.0060);

-- Confirm location_geom is generated:
SELECT id, name, lat, lng, location_geom FROM courts WHERE name = 'Smoke Test Court';

-- Call courts_nearby:
SELECT * FROM courts_nearby(40.71, -74.00, 10000);

-- Cleanup:
DELETE FROM courts WHERE name = 'Smoke Test Court';
*/
