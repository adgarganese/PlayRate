-- Migration: profiles rep columns, courts (add columns), runs, run_participants
-- Idempotent: adds only missing columns; creates tables with IF NOT EXISTS.
-- Safe for fresh DB: creates courts if not exists so ALTER TABLE courts does not fail.

-- ============================================
-- 1) PROFILES: add rep_level, rep_points if missing
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rep_level INT NOT NULL DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rep_points INT NOT NULL DEFAULT 0;

-- ============================================
-- 2) COURTS: ensure PostGIS + courts table + add columns if missing
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure courts exists so ALTER TABLE below never fails on fresh DB (no "ALTER EXTENSION postgis SET SCHEMA").
CREATE TABLE IF NOT EXISTS courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat numeric(10, 8),
  lng numeric(11, 8),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Courts table may already exist (id, name, address, lat, lng, created_by, created_at).
-- Add new columns only.
ALTER TABLE courts ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS indoor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================
-- 3) RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  skill_band TEXT NOT NULL CHECK (skill_band IN ('casual', 'balanced', 'competitive')),
  skill_min INT CHECK (skill_min BETWEEN 1 AND 10),
  skill_max INT CHECK (skill_max BETWEEN 1 AND 10),
  capacity INT NOT NULL DEFAULT 10 CHECK (capacity BETWEEN 2 AND 40),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_starts_at ON runs(starts_at);
CREATE INDEX IF NOT EXISTS idx_runs_court_starts ON runs(court_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_runs_creator_id ON runs(creator_id);

-- ============================================
-- 4) RUN_PARTICIPANTS
-- ============================================
CREATE TABLE IF NOT EXISTS run_participants (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'organizer')),
  join_status TEXT NOT NULL DEFAULT 'joined' CHECK (join_status IN ('joined', 'waitlist', 'left')),
  checked_in_at TIMESTAMPTZ,
  attended BOOLEAN,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_run_participants_user_id ON run_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_run_participants_run_id ON run_participants(run_id);
CREATE INDEX IF NOT EXISTS idx_run_participants_checked_in_at ON run_participants(checked_in_at);
