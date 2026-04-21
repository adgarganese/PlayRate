-- Athletes list + profile sports join: speed up .in('profile_id', ids) from the app.
-- Safe if an equivalent index already exists (IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_profile_sports_profile_id ON public.profile_sports (profile_id);
