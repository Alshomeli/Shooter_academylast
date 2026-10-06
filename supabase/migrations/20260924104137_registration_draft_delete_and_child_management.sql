-- Registration draft child-management and deletion workflow.
-- Reconstructed from the live schema. File cleanup is intentionally not performed
-- here; the later cleanup-outbox migrations add coordinated storage cleanup.

create or replace function internal.add_registration_child(
  p_application_id uuid,
  p_child jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_app public.registration_applications%rowtype;
  v_child_id uuid := gen_random_uuid();
  v_client_key text := nullif(trim(coalesce(p_child->>'clientKey','')),'');
  v_name text := trim(coalesce(p_child->>'fullName',''));
  v_national_id text := trim(coalesce(p_child->>'nationalId',''));
  v_birth_date date;
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

  if length(v_name) < 2 then
    raise exception 'Child name is required';
  end if;

  if v_national_id = '' then
    raise exception 'Child CPR is required';
  end if;

  if coalesce(p_child->>'birthDate','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Valid child birth date is required';
  end if;

  v_birth_date := (p_child->>'birthDate')::date;

  if v_client_key is not null and exists (
    select 1
    from public.registration_children
    where application_id = p_application_id
      and client_key = v_client_key
  ) then
    raise exception 'Duplicate child client key';
  end if;

  insert into public.registration_children(
    id, client_key, application_id, full_name, national_id,
    birth_date, blood_type, parent_notes
  )
  values (
    v_child_id, v_client_key, p_application_id, v_name, v_national_id,
    v_birth_date,
    nullif(trim(coalesce(p_child->>'bloodType','')),''),
    nullif(trim(coalesce(p_child->>'notes','')),'')
  );

  update public.registration_applications
  set updated_at = now()
  where id = p_application_id;

  return jsonb_build_object(
    'childId', v_child_id,
    'clientKey', v_client_key,
    'fullName', v_name
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

create or replace function public.add_registration_child(
  p_application_id uuid,
  p_child jsonb
)
returns jsonb
language sql
set search_path to ''
as $function$
  select internal.add_registration_child(p_application_id, p_child)
$function$;

create or replace function public.delete_registration_child(
  p_application_id uuid,
  p_child_id uuid
)
returns void
language sql
set search_path to ''
as $function$
  select internal.delete_registration_child(p_application_id, p_child_id)
$function$;

create or replace function public.delete_registration_application(
  p_application_id uuid
)
returns jsonb
language sql
set search_path to ''
as $function$
  select internal.delete_registration_application(p_application_id)
$function$;
