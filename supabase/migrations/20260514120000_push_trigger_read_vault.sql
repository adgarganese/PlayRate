-- =============================================================================
-- Push: read Supabase Functions base URL + service role JWT from Vault
-- =============================================================================
-- Supersedes the current_setting-based configuration in
-- 20260414121100_push_notification_tokens.sql.
--
-- ALTER DATABASE ... SET app.settings.* is denied for the postgres role
-- on managed Supabase (ERROR 42501). This migration moves both values
-- into Supabase Vault and rewrites the trigger function to read from
-- vault.decrypted_secrets instead of current_setting.
--
-- Required Vault secrets (must be created before this migration takes
-- effect — function silently no-ops if either is missing):
--   1) name: supabase_functions_url
--      value: https://<project-ref>.supabase.co/functions/v1
--             (no trailing slash; '/send-push-notification' is appended in SQL)
--   2) name: service_role_key
--      value: <service_role JWT> (same as SUPABASE_SERVICE_ROLE_KEY env)
--
-- Trigger on_notification_inserted is NOT recreated; it already calls
-- this function name and remains attached to public.notifications.
-- =============================================================================

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
  SELECT nullif(trim(ds.decrypted_secret::text), '')
  INTO base_url
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'supabase_functions_url'
  ORDER BY ds.updated_at DESC NULLS LAST, ds.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT nullif(trim(ds.decrypted_secret::text), '')
  INTO sr_key
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'service_role_key'
  ORDER BY ds.updated_at DESC NULLS LAST, ds.created_at DESC NULLS LAST
  LIMIT 1;

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

-- Defensive: ensure function ownership stays at postgres so SECURITY DEFINER
-- has the privileges needed to read vault.decrypted_secrets. No-op if
-- already postgres (current production state).
ALTER FUNCTION public.trigger_push_on_notification() OWNER TO postgres;
