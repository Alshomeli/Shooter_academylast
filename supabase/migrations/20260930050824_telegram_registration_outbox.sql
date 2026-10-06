create table if not exists internal.telegram_registration_outbox (
  application_id uuid primary key references public.registration_applications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on internal.telegram_registration_outbox from public, anon, authenticated;

create or replace function internal.queue_telegram_registration_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
    insert into internal.telegram_registration_outbox(application_id,status,attempts,last_error,queued_at,sent_at,updated_at)
    values(new.id,'pending',0,null,now(),null,now())
    on conflict(application_id) do update
      set status='pending',last_error=null,queued_at=now(),sent_at=null,updated_at=now();
  end if;
  return new;
end;
$$;
revoke all on function internal.queue_telegram_registration_notification() from public,anon,authenticated;

drop trigger if exists trg_queue_telegram_registration_notification on public.registration_applications;
create trigger trg_queue_telegram_registration_notification
after insert or update on public.registration_applications
for each row execute function internal.queue_telegram_registration_notification();

create or replace function public.telegram_claim_registration_notifications(p_limit integer default 10)
returns table(application_id uuid,parent_full_name text,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if current_user <> 'service_role' then
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
  if current_user <> 'service_role' then
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

create index if not exists telegram_registration_outbox_status_idx
on internal.telegram_registration_outbox(status,queued_at);
