-- Device push tokens (Expo) + optional pg_net trigger to call Edge Function on new in-app notification.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON public.device_push_tokens(user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tokens" ON public.device_push_tokens;
CREATE POLICY "Users manage own tokens"
  ON public.device_push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.device_push_tokens TO authenticated;

-- ---------------------------------------------------------------------------
-- Optional: after INSERT on notifications, POST to Edge Function (requires pg_net).
-- If pg_net is not installed, this block is skipped — call send-push-notification from
-- application code, a scheduled job, or enable pg_net and re-run a migration that
-- creates the trigger.
-- Configure database settings before relying on HTTP:
--   ALTER DATABASE postgres SET app.settings.supabase_functions_url = 'https://<project-ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_jwt>';
-- Missing settings → trigger no-ops (returns NEW without HTTP).
-- ---------------------------------------------------------------------------
DO $push_trigger$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed: skipping push notification trigger. Use client/server to call send-push-notification.';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $func$
    DECLARE
      base_url text;
      sr_key text;
    BEGIN
      BEGIN
        base_url := nullif(trim(current_setting('app.settings.supabase_functions_url', true)), '');
      EXCEPTION WHEN undefined_object THEN
        base_url := NULL;
      END;

      BEGIN
        sr_key := nullif(trim(current_setting('app.settings.service_role_key', true)), '');
      EXCEPTION WHEN undefined_object THEN
        sr_key := NULL;
      END;

      IF base_url IS NULL OR sr_key IS NULL THEN
        RETURN NEW;
      END IF;

      PERFORM net.http_post(
        url := base_url || '/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || sr_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'title', NEW.title,
          'body', COALESCE(NEW.body, ''),
          'data', jsonb_build_object(
            'type', NEW.type,
            'entity_type', COALESCE(NEW.entity_type, ''),
            'entity_id', COALESCE(NEW.entity_id::text, ''),
            'actor_id', COALESCE(NEW.actor_id::text, '')
          )
        )
      );

      RETURN NEW;
    END;
    $func$;
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS on_notification_inserted ON public.notifications';
  EXECUTE 'CREATE TRIGGER on_notification_inserted AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification()';
END;
$push_trigger$;
