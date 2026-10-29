-- Forward-only repair. No queue rows are consumed and no messages are sent here.
-- SECURITY DEFINER changes current_user to the function owner, so it cannot
-- identify the PostgREST caller. Check the actual SET ROLE and keep service-only ACLs.
-- Login outbox IDs are UUIDs; login audit IDs are independent text identifiers.
-- Applying this repair lets the existing dispatcher resume queued notifications.
create or replace function public.telegram_claim_registration_notifications(p_limit integer default 10)
returns table(application_id uuid,parent_full_name text,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('role', true) IS DISTINCT FROM 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  return query
  with claimed as (
    select o.application_id
    from internal.telegram_registration_outbox o
    join public.registration_applications a on a.id=o.application_id
    where o.status in ('pending','failed') and o.attempts < 5 and a.status='pending'
    order by o.queued_at
    for update of o skip locked
    limit greatest(1,least(coalesce(p_limit,10),25))
  ), updated as (
    update internal.telegram_registration_outbox o
    set status='processing',attempts=o.attempts+1,updated_at=now()
    from claimed c where o.application_id=c.application_id
    returning o.application_id
  )
  select a.id,a.parent_full_name,a.submitted_at
  from updated u join public.registration_applications a on a.id=u.application_id;
end;
$$;
revoke all on function public.telegram_claim_registration_notifications(integer) from public,anon,authenticated;
grant execute on function public.telegram_claim_registration_notifications(integer) to service_role;

create or replace function public.telegram_finish_registration_notification(p_application_id uuid,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('role', true) IS DISTINCT FROM 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  update internal.telegram_registration_outbox
  set status=case when p_success then 'sent' else 'failed' end,
      sent_at=case when p_success then now() else sent_at end,
      last_error=case when p_success then null else left(coalesce(p_error,'unknown'),500) end,
      updated_at=now()
  where application_id=p_application_id;
end;
$$;
revoke all on function public.telegram_finish_registration_notification(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.telegram_finish_registration_notification(uuid,boolean,text) to service_role;

CREATE OR REPLACE FUNCTION public.telegram_claim_login_notifications(p_limit integer DEFAULT 10)
RETURNS TABLE(outbox_id uuid, audit_role text, audit_user_name text, audit_details text, audit_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
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
  JOIN internal.telegram_login_outbox o ON o.id = u.id
  JOIN public.login_audit_logs a ON a.id = o.login_audit_id;
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
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
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


revoke all on function public.telegram_claim_login_notifications(integer) from public,anon,authenticated;
grant execute on function public.telegram_claim_login_notifications(integer) to service_role;

revoke all on function public.telegram_finish_login_notification(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.telegram_finish_login_notification(uuid,boolean,text) to service_role;

notify pgrst,'reload schema';
