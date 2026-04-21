/*
 * Ensure every profile has a notification_prefs row with beta-friendly defaults (all true).
 * Adds dm/follow/cosign prefs, flips defaults, backfills existing users, and adds auto-create trigger for new signups.
 */

-- New per-channel toggles (idempotent).
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS dm_notifications BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS follow_notifications BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS cosign_notifications BOOLEAN NOT NULL DEFAULT true;

-- Future inserts default all toggles on (existing row values unchanged).
ALTER TABLE public.notification_prefs
  ALTER COLUMN run_reminder_2h SET DEFAULT true;

ALTER TABLE public.notification_prefs
  ALTER COLUMN run_reminder_30m SET DEFAULT true;

ALTER TABLE public.notification_prefs
  ALTER COLUMN court_new_runs SET DEFAULT true;

ALTER TABLE public.notification_prefs
  ALTER COLUMN friends_checkin SET DEFAULT true;

-- One prefs row per profile missing one; all seven booleans true.
INSERT INTO public.notification_prefs (
  user_id,
  run_reminder_2h,
  run_reminder_30m,
  court_new_runs,
  friends_checkin,
  dm_notifications,
  follow_notifications,
  cosign_notifications
)
SELECT
  p.user_id,
  true,
  true,
  true,
  true,
  true,
  true,
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_prefs np WHERE np.user_id = p.user_id
)
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.notification_prefs (
    user_id,
    run_reminder_2h,
    run_reminder_30m,
    court_new_runs,
    friends_checkin,
    dm_notifications,
    follow_notifications,
    cosign_notifications
  )
  VALUES (
    NEW.user_id,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_inserted_create_notification_prefs ON public.profiles;

CREATE TRIGGER on_profile_inserted_create_notification_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_prefs();
