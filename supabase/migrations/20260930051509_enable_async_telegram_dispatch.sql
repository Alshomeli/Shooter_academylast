create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function internal.dispatch_telegram_registration_outbox()
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  if not exists (
    select 1 from internal.telegram_registration_outbox
    where status in ('pending','failed') and attempts < 5
  ) then
    return null;
  end if;

  v_url := 'https://jgvfruijtixguavspyer.supabase.co/functions/v1/telegram-reply';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='telegram_webhook_secret'
  limit 1;

  if v_secret is null or length(v_secret)=0 then
    raise warning 'telegram_webhook_secret is not present in Vault; notification remains queued';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Telegram-Bot-Api-Secret-Token',v_secret
    ),
    body := jsonb_build_object('action','flush_registration_notifications'),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$$;
revoke all on function internal.dispatch_telegram_registration_outbox() from public,anon,authenticated;

create or replace function internal.queue_telegram_registration_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
    insert into internal.telegram_registration_outbox(application_id,status,attempts,last_error,queued_at,sent_at,updated_at)
    values(new.id,'pending',0,null,now(),null,now())
    on conflict(application_id) do update
      set status='pending',last_error=null,queued_at=now(),sent_at=null,updated_at=now();

    perform internal.dispatch_telegram_registration_outbox();
  end if;
  return new;
end;
$$;

select cron.schedule(
  'telegram-registration-outbox-retry',
  '*/5 * * * *',
  $$select internal.dispatch_telegram_registration_outbox();$$
)
where not exists (
  select 1 from cron.job where jobname='telegram-registration-outbox-retry'
);
