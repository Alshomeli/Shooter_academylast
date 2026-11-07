/*
# Add manager login notifications via Telegram

1. Plain-English summary
   - Every time a manager, staff member, coach, accountant or receptionist signs in,
     the academy manager now receives a Telegram notification about it.
   - New registrations already send Telegram notifications; this adds the same
     behaviour for sign-ins ("تسجيل دخول جديد").

2. How it works (mirrors the existing registration notification pipeline)
   - When a sign-in is recorded in `public.login_audit_logs`, a new row is queued in
     `internal.telegram_login_outbox` (status `pending`).
   - The existing scheduled retry job (every 5 minutes) already calls
     `internal.dispatch_telegram_registration_outbox()`, which now ALSO dispatches a
     flush request when login notifications are waiting, so no new cron job is needed.
   - The Telegram edge function claims waiting login notifications through the new
     `public.telegram_claim_login_notifications` RPC (service-role only), sends an
     Arabic message to every authorized manager chat, and finishes each row via
     `public.telegram_finish_login_notification` (success or failure, max 5 attempts).

3. New objects
   - Table `internal.telegram_login_outbox`:
     - `id` (uuid, primary key)
     - `login_audit_id` (text, unique — the `login_audit_logs.id` this notification is for)
     - `status` (text: pending | processing | sent | failed)
     - `attempts` (integer, default 0)
     - `last_error` (text, nullable)
     - `queued_at`, `sent_at`, `updated_at` (timestamptz)
   - Function `internal.notify_managers_new_login()` (trigger function): inserts one
     outbox row per new login audit log; failures are swallowed so sign-ins never break.
   - Trigger `trg_notify_managers_new_login` on `public.login_audit_logs` AFTER INSERT.
   - Function `public.telegram_claim_login_notifications(p_limit integer)`: SECURITY
     DEFINER, service-role only, atomically claims up to 10 pending/failed rows and
     returns the matching audit entries (role, user name, details, timestamp).
   - Function `public.telegram_finish_login_notification(p_id uuid, p_success boolean,
     p_error text)`: SECURITY DEFINER, service-role only, marks a claimed row sent/failed.

4. Modified objects
   - `internal.dispatch_telegram_registration_outbox()`: now also checks the login
     outbox before skipping the dispatch; the vault secret and cron job stay unchanged.

5. Security
   - The outbox lives in the `internal` schema: no direct client access.
   - Both new public RPCs require `current_user = 'service_role'`.
   - No RLS changes on existing tables; no data is modified or deleted.

6. Important notes
   - Idempotent: every statement uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
   - Only rows whose audit `action` is 'login' are queued (the app only writes 'login').
*/

CREATE TABLE IF NOT EXISTS internal.telegram_login_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_audit_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION internal.notify_managers_new_login()
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_managers_new_login ON public.login_audit_logs;
CREATE TRIGGER trg_notify_managers_new_login
AFTER INSERT ON public.login_audit_logs
FOR EACH ROW EXECUTE FUNCTION internal.notify_managers_new_login();

CREATE OR REPLACE FUNCTION public.telegram_claim_login_notifications(p_limit integer DEFAULT 10)
RETURNS TABLE(outbox_id uuid, audit_role text, audit_user_name text, audit_details text, audit_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM internal.telegram_login_outbox o
    JOIN public.login_audit_logs a ON a.id = o.login_audit_id
    WHERE o.status IN ('pending','failed') AND o.attempts < 5
    ORDER BY o.queued_at
    FOR UPDATE OF o SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 25))
  ), updated AS (
    UPDATE internal.telegram_login_outbox o
    SET status = 'processing', attempts = o.attempts + 1, updated_at = now()
    FROM claimed c WHERE o.id = c.id
    RETURNING o.id
  )
  SELECT u.id, a.user_role, a.user_name, a.details, a.timestamp
  FROM updated u
  JOIN public.login_audit_logs a ON a.id = u.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.telegram_finish_login_notification(
  p_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  UPDATE internal.telegram_login_outbox
  SET status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
      sent_at = CASE WHEN p_success THEN now() ELSE sent_at END,
      last_error = CASE WHEN p_success THEN NULL ELSE LEFT(COALESCE(p_error, 'unknown'), 500) END,
      updated_at = now()
  WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.dispatch_telegram_registration_outbox()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM internal.telegram_registration_outbox WHERE status IN ('pending','failed') AND attempts < 5)
     AND NOT EXISTS(SELECT 1 FROM internal.telegram_staff_application_outbox WHERE status IN ('pending','failed') AND attempts < 5)
     AND NOT EXISTS(SELECT 1 FROM internal.telegram_login_outbox WHERE status IN ('pending','failed') AND attempts < 5)
  THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_dispatch_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := 'https://jgvfruijtixguavspyer.supabase.co/functions/v1/telegram-reply',
    headers := jsonb_build_object('Content-Type','application/json','X-Shooter-Dispatch-Secret', v_secret),
    body := jsonb_build_object('action','flush_registration_notifications'),
    timeout_milliseconds := 5000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$function$;
