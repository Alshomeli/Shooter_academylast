alter table public.registration_applications
  add column if not exists registration_type text not null default 'new_application';

alter table public.registration_applications
  drop constraint if exists chk_registration_applications_registration_type;

alter table public.registration_applications
  add constraint chk_registration_applications_registration_type
  check (registration_type in ('initial_onboarding','new_application'));

comment on column public.registration_applications.registration_type is
  'Registration business context: initial_onboarding for existing academy members during launch, new_application for new applicants.';

create or replace function internal.create_registration_draft(p_parent jsonb, p_children jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_auth_email text;
  v_app_id uuid := gen_random_uuid();
  v_child jsonb;
  v_child_id uuid;
  v_children_result jsonb := '[]'::jsonb;
  v_parent_name text := trim(coalesce(p_parent->>'fullName',''));
  v_parent_cpr text := trim(coalesce(p_parent->>'nationalId',''));
  v_parent_phone text := trim(coalesce(p_parent->>'phone',''));
  v_parent_email text := lower(trim(coalesce(p_parent->>'email','')));
  v_registration_type text := coalesce(nullif(trim(p_parent->>'registrationType'),''),'new_application');
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;

  if v_registration_type not in ('initial_onboarding','new_application') then
    raise exception 'Invalid registration type';
  end if;

  select lower(u.email) into v_auth_email from auth.users u where u.id = v_uid;
  if v_auth_email is null then raise exception 'Authenticated email is required'; end if;
  if v_parent_email <> v_auth_email then raise exception 'Registration email must match the authenticated account email'; end if;
  if length(v_parent_name) < 2 then raise exception 'Parent name is required'; end if;
  if v_parent_cpr = '' then raise exception 'Parent CPR is required'; end if;
  if v_parent_phone = '' then raise exception 'Parent phone is required'; end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) < 1 then raise exception 'At least one child is required'; end if;

  insert into public.registration_applications(
    id, applicant_user_id, parent_full_name, parent_national_id, parent_phone,
    parent_whatsapp, parent_email, parent_nationality, parent_occupation,
    parent_workplace, parent_address, parent_notes, status, submitted_at,
    registration_type
  ) values (
    v_app_id, v_uid, v_parent_name, v_parent_cpr, v_parent_phone,
    nullif(trim(coalesce(p_parent->>'whatsapp','')),''), v_parent_email,
    nullif(trim(coalesce(p_parent->>'nationality','')),''),
    nullif(trim(coalesce(p_parent->>'occupation','')),''),
    nullif(trim(coalesce(p_parent->>'workplace','')),''),
    nullif(trim(coalesce(p_parent->>'address','')),''),
    nullif(trim(coalesce(p_parent->>'notes','')),''),
    'draft', null, v_registration_type
  );

  for v_child in select value from jsonb_array_elements(p_children)
  loop
    if length(trim(coalesce(v_child->>'fullName',''))) < 2 then raise exception 'Child name is required'; end if;
    if trim(coalesce(v_child->>'nationalId','')) = '' then raise exception 'Child CPR is required'; end if;
    if coalesce(v_child->>'birthDate','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Valid child birth date is required'; end if;

    v_child_id := gen_random_uuid();
    insert into public.registration_children(
      id, application_id, full_name, national_id, birth_date, blood_type, parent_notes
    ) values (
      v_child_id, v_app_id,
      trim(v_child->>'fullName'), trim(v_child->>'nationalId'), (v_child->>'birthDate')::date,
      nullif(trim(coalesce(v_child->>'bloodType','')),''),
      nullif(trim(coalesce(v_child->>'notes','')),'')
    );

    v_children_result := v_children_result || jsonb_build_array(
      jsonb_build_object('clientKey',v_child->>'clientKey','childId',v_child_id,'fullName',trim(v_child->>'fullName'))
    );
  end loop;

  return jsonb_build_object(
    'applicationId',v_app_id,
    'status','draft',
    'registrationType',v_registration_type,
    'children',v_children_result
  );
end;
$function$;
