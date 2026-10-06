-- Keep registration database deletion transactional.
-- Storage objects are not deleted inside these RPCs. A later migration introduces
-- a durable cleanup outbox that coordinates storage deletion after the DB commit.

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

  delete from public.registration_children
  where id = p_child_id
    and application_id = p_application_id;

  update public.registration_applications
  set updated_at = now()
  where id = p_application_id;
end
$function$;

create or replace function internal.delete_registration_application(
  p_application_id uuid
)
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

  delete from public.registration_applications
  where id = p_application_id;

  return jsonb_build_object(
    'success', true,
    'applicationId', p_application_id,
    'status', v_app.status
  );
end
$function$;
