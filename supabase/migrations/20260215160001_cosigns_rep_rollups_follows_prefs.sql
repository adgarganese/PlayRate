-- Migration: cosigns (run-scoped, attribute-based), rep_rollups, court_follows, notification_prefs
-- Drops existing cosigns trigger/table and recreates per new spec.

-- ============================================
-- 1) COSIGNS: drop old trigger and table, create new schema
-- ============================================
DROP TRIGGER IF EXISTS cosigns_update_profile_stats ON cosigns;
DROP TABLE IF EXISTS cosigns CASCADE;

CREATE TABLE cosigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL CHECK (attribute IN (
    'shooting', 'handles', 'finishing', 'defense', 'iq', 'passing',
    'rebounding', 'hustle', 'athleticism', 'leadership'
  )),
  note TEXT CHECK (char_length(note) <= 140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cosigns_no_self CHECK (from_user_id != to_user_id),
  CONSTRAINT cosigns_unique_per_run_attribute UNIQUE (from_user_id, to_user_id, run_id, attribute)
);

CREATE INDEX idx_cosigns_to_user_id ON cosigns(to_user_id);
CREATE INDEX idx_cosigns_run_id ON cosigns(run_id);
CREATE INDEX idx_cosigns_created_at ON cosigns(created_at);

-- ============================================
-- 2) REP_ROLLUPS
-- ============================================
CREATE TABLE IF NOT EXISTS rep_rollups (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  total_cosigns INT NOT NULL DEFAULT 0,
  cosigns_by_attribute JSONB NOT NULL DEFAULT '{}'::jsonb,
  rep_level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3) COURT_FOLLOWS (distinct from existing followed_courts if present)
-- ============================================
CREATE TABLE IF NOT EXISTS court_follows (
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  PRIMARY KEY (court_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_court_follows_user_id ON court_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_court_follows_court_id ON court_follows(court_id);

-- ============================================
-- 4) NOTIFICATION_PREFS
-- ============================================
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  run_reminder_2h BOOLEAN NOT NULL DEFAULT false,
  run_reminder_30m BOOLEAN NOT NULL DEFAULT false,
  court_new_runs BOOLEAN NOT NULL DEFAULT false,
  friends_checkin BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);
