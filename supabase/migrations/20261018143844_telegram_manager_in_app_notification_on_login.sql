/*
# In-app manager notification on new sign-ins

1. Plain-English summary
   - In addition to the Telegram alert, a new sign-in (manager, coach, accountant,
     receptionist) now also creates an in-app notification for the academy manager.
     The text mirrors the Telegram message (name, role, time) so the manager sees
     "someone signed in" even when Telegram is not open.

2. Changes in this migration
   - Replaces the trigger function `internal.notify_managers_new_login()` with
     `internal.handle_login_audit_notify()`. For every new row in
     `public.login_audit_logs` with action = 'login', it (a) queues the Telegram
     outbox row (existing pipeline), and (b) inserts a manager-wide row into
     `public.notifications` (recipient_user_id = NULL, type = 'login').
   - Recreates trigger `trg_notify_managers_new_login` to call the new function.
   - Both write paths are wrapped in per-EXCEPTION fallbacks so sign-in is never blocked.

3. Security
   - Notification writes remain server-side (trigger path); no new client surface.
   - `public.notifications.type` accepts a new 'login' value; existing read filters
     accept it because the app filters on `read` only.

4. Important notes
   - Idempotent: OR REPLACE used on function; trigger dropped + recreated.
   - The old function `internal.notify_managers_new_login()` is replaced, not removed
     (keeps history); the trigger now points at the new function.
*/

CREATE OR REPLACE FUNCTION internal.handle_login_audit_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.action <> 'login' THEN RETURN NEW; END IF;

  BEGIN
    INSERT INTO internal.telegram_login_outbox (login_audit_id)
    VALUES (NEW.id)
    ON CONFLICT (login_audit_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.notifications (id, title, message, timestamp, type, read, recipient_user_id, created_at)
    VALUES (
      gen_random_uuid()::text,
      'تسجيل دخول جديد',
      'الاسم: ' || NEW.user_name || ' — الصفة: ' || CASE NEW.user_role
        WHEN 'manager' THEN 'مدير'
        WHEN 'coach' THEN 'مدرب'
        WHEN 'accountant' THEN 'محاسب'
        ELSE NEW.user_role END || ' — الوقت: ' || NEW.timestamp,
      NEW.timestamp,
      'login',
      false,
      NULL,
      now()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_managers_new_login ON public.login_audit_logs;
CREATE TRIGGER trg_notify_managers_new_login
AFTER INSERT ON public.login_audit_logs
FOR EACH ROW EXECUTE FUNCTION internal.handle_login_audit_notify();
