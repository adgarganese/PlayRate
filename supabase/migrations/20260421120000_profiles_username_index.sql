/*
 * Support server-side ilike prefix search on profiles.username and profiles.name.
 * pg_trgm enabled for future fuzzy search.
 */

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles (lower(username) varchar_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_name_lower ON profiles (lower(name) varchar_pattern_ops);
