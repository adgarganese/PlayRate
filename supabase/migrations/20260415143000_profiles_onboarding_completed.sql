-- One-time onboarding flag: new profiles default to incomplete; existing rows are marked complete so current users are not forced through the flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.onboarding_completed IS 'When true, post-auth routing sends the user to the main app instead of /onboarding.';

-- Existing accounts (pre-migration) skip onboarding once.
UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed IS DISTINCT FROM true;
