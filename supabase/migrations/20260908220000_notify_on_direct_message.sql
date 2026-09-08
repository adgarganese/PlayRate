-- DMs were only notifying via a client RPC (fire-and-forget). TestFlight 29
-- inserts messages successfully (inbox badge) without a notifications row, so
-- the push trigger never runs. Likes/reposts already notify from DB triggers.
-- Create the in-app + push row on message insert so lock-screen DMs work
-- without a new binary.

CREATE OR REPLACE FUNCTION public.trigger_notify_on_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  recipient_id uuid;
  sender_label text;
  preview text;
BEGIN
  SELECT COALESCE(NULLIF(trim(p.name), ''), p.username, 'Someone')
  INTO sender_label
  FROM public.profiles p
  WHERE p.user_id = NEW.sender_id;

  preview := left(NEW.body, 100);
  IF char_length(NEW.body) > 100 THEN
    preview := left(NEW.body, 97) || '...';
  END IF;

  FOR recipient_id IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id IS DISTINCT FROM NEW.sender_id
  LOOP
    BEGIN
      PERFORM public.create_notification(
        recipient_id,
        NEW.sender_id,
        'new_message',
        'conversation',
        NEW.conversation_id,
        COALESCE(sender_label, 'Someone') || ' sent you a message',
        preview,
        '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trigger_notify_on_direct_message: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$func$;

ALTER FUNCTION public.trigger_notify_on_direct_message() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_message_inserted_notify ON public.messages;
CREATE TRIGGER on_message_inserted_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_on_direct_message();
