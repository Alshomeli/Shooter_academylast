-- Reconstructed from the live Supabase schema to keep repository migrations
-- aligned with the already-applied registration cleanup outbox workflow.

create table if not exists internal.registration_file_cleanup (
  storage_path text primary key,
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  constraint registration_file_cleanup_storage_path_check
    check (storage_path like 'applications/%')
);

create index if not exists registration_file_cleanup_requester_created_idx
  on internal.registration_file_cleanup (requested_by, created_at);

alter table internal.registration_file_cleanup enable row level security;

revoke all on table internal.registration_file_cleanup from public, anon, authenticated;

create or replace function internal.queue_registration_file_cleanup(
  p_application_id uuid,
  p_child_id uuid default null
)
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into internal.registration_file_cleanup(storage_path, requested_by)
  select d.storage_path, (select auth.uid())
  from public.registration_documents d
  where d.application_id = p_application_id
    and (p_child_id is null or d.child_id = p_child_id)
    and d.storage_path like 'applications/%'
    and not exists (
      select 1
      from public.player_documents pd
      where pd.file_path = d.storage_path
    )
  on conflict (storage_path) do nothing;
end
$function$;

create or replace function internal.can_cleanup_registration_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from internal.registration_file_cleanup q
      where q.storage_path = p_path
        and (
          q.requested_by = (select auth.uid())
          or (select internal.is_academy_admin())
        )
    )
    and not exists (
      select 1
      from public.registration_documents d
      where d.storage_path = p_path
    )
    and not exists (
      select 1
      from public.player_documents d
      where d.file_path = p_path
    )
$function$;

create or replace function internal.get_registration_file_cleanup()
returns setof text
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select q.storage_path
  from internal.registration_file_cleanup q
  where internal.can_cleanup_registration_file(q.storage_path)
  order by q.created_at, q.storage_path
  limit 100;
end
$function$;

create or replace function internal.ack_registration_file_cleanup(p_paths text[])
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_paths), 0) > 100 then
    raise exception 'At most 100 paths per batch';
  end if;

  delete from internal.registration_file_cleanup q
  where q.storage_path = any(p_paths)
    and internal.can_cleanup_registration_file(q.storage_path)
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'player-documents'
        and o.name = q.storage_path
    );

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

create or replace function public.get_registration_file_cleanup()
returns setof text
language sql
set search_path to ''
as $function$
  select internal.get_registration_file_cleanup()
$function$;

create or replace function public.ack_registration_file_cleanup(p_paths text[])
returns integer
language sql
set search_path to ''
as $function$
  select internal.ack_registration_file_cleanup(p_paths)
$function$;

revoke all on function internal.queue_registration_file_cleanup(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function internal.can_cleanup_registration_file(text) from public, anon, authenticated, service_role;
revoke all on function internal.get_registration_file_cleanup() from public, anon, authenticated, service_role;
revoke all on function internal.ack_registration_file_cleanup(text[]) from public, anon, authenticated, service_role;

grant execute on function internal.can_cleanup_registration_file(text) to authenticated;
grant execute on function internal.get_registration_file_cleanup() to authenticated;
grant execute on function internal.ack_registration_file_cleanup(text[]) to authenticated;

revoke all on function public.get_registration_file_cleanup() from public, anon, authenticated, service_role;
revoke all on function public.ack_registration_file_cleanup(text[]) from public, anon, authenticated, service_role;

grant execute on function public.get_registration_file_cleanup() to authenticated, service_role;
grant execute on function public.ack_registration_file_cleanup(text[]) to authenticated, service_role;

drop policy if exists registration_cleanup_select on storage.objects;
create policy registration_cleanup_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'player-documents'
  and internal.can_cleanup_registration_file(name)
);

drop policy if exists registration_cleanup_delete on storage.objects;
create policy registration_cleanup_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'player-documents'
  and internal.can_cleanup_registration_file(name)
);

create or replace function internal.delete_registration_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_app public.registration_applications%rowtype;
  v_is_manager boolean := (select internal.is_academy_admin());
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
  into v_app
  from public.registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Registration application not found';
  end if;

  if not v_is_manager then
    if v_app.applicant_user_id is distinct from v_uid then
      raise exception 'Registration access denied' using errcode='42501';
    end if;
    if v_app.status not in ('draft','needs_info') then
      raise exception 'Only draft or needs-info applications can be deleted by the applicant';
    end if;
  end if;

  perform internal.queue_registration_file_cleanup(p_application_id, null);

  delete from public.registration_applications
  where id = p_application_id;

  return jsonb_build_object(
    'success', true,
    'applicationId', p_application_id,
    'status', v_app.status
  );
end
$function$;

create or replace function internal.delete_registration_child(
  p_application_id uuid,
  p_child_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_app public.registration_applications%rowtype;
  v_child_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
  into v_app
  from public.registration_applications
  where id = p_application_id
    and applicant_user_id = v_uid
  for update;

  if not found then
    raise exception 'Registration access denied' using errcode='42501';
  end if;

  if v_app.status not in ('draft','needs_info') then
    raise exception 'Application cannot be changed after submission';
  end if;

  select count(*)
  into v_child_count
  from public.registration_children
  where application_id = p_application_id;

  if v_child_count <= 1 then
    raise exception 'At least one child is required';
  end if;

  if not exists (
    select 1
    from public.registration_children
    where id = p_child_id
      and application_id = p_application_id
  ) then
    raise exception 'Child does not belong to this application';
  end if;

  perform internal.queue_registration_file_cleanup(p_application_id, p_child_id);

  delete from public.registration_children
  where id = p_child_id
    and application_id = p_application_id;

  update public.registration_applications
  set updated_at = now()
  where id = p_application_id;
end
$function$;
