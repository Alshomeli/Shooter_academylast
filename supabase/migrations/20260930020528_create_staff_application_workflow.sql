create table if not exists public.staff_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('coach','accountant','receptionist')),
  full_name text not null,
  email text not null,
  phone text not null,
  national_id text,
  specialization text,
  experience_years integer check (experience_years is null or experience_years >= 0),
  licenses text[] not null default '{}',
  applicant_notes text,
  status text not null default 'draft' check (status in ('draft','pending','needs_info','approved','rejected')),
  review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_staff_id text references public.staff(id) on delete set null,
  approved_staff_id text references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_applications_open_user_key
  on public.staff_applications(applicant_user_id)
  where status in ('draft','pending','needs_info');

create index if not exists idx_staff_applications_status
  on public.staff_applications(status, created_at desc);

alter table public.staff_applications enable row level security;

drop policy if exists staff_applications_select on public.staff_applications;
create policy staff_applications_select
on public.staff_applications
for select
to authenticated
using (
  applicant_user_id = (select auth.uid())
  or (select internal.is_academy_admin())
);

revoke all on public.staff_applications from public, anon, authenticated;
grant select on public.staff_applications to authenticated;

create or replace function internal.create_or_update_staff_application(
  p_requested_role text,
  p_full_name text,
  p_phone text,
  p_national_id text default null,
  p_specialization text default null,
  p_experience_years integer default null,
  p_licenses text[] default '{}',
  p_applicant_notes text default null
)
returns public.staff_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_row public.staff_applications;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_requested_role not in ('coach','accountant','receptionist') then
    raise exception 'Invalid requested role';
  end if;

  select lower(trim(email)) into v_email
  from auth.users
  where id = v_uid;

  if v_email is null then
    raise exception 'Authenticated email required';
  end if;

  if nullif(trim(coalesce(p_full_name,'')), '') is null then
    raise exception 'Full name required';
  end if;
  if nullif(trim(coalesce(p_phone,'')), '') is null then
    raise exception 'Phone required';
  end if;
  if p_experience_years is not null and p_experience_years < 0 then
    raise exception 'Invalid experience years';
  end if;

  if exists (select 1 from public.staff where user_id=v_uid) then
    raise exception 'Staff account already exists';
  end if;

  select * into v_row
  from public.staff_applications
  where applicant_user_id=v_uid
    and status in ('draft','needs_info')
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.staff_applications
    set requested_role=p_requested_role,
        full_name=trim(p_full_name),
        email=v_email,
        phone=trim(p_phone),
        national_id=nullif(trim(coalesce(p_national_id,'')), ''),
        specialization=nullif(trim(coalesce(p_specialization,'')), ''),
        experience_years=p_experience_years,
        licenses=coalesce(p_licenses,'{}'),
        applicant_notes=nullif(trim(coalesce(p_applicant_notes,'')), ''),
        status='draft',
        review_notes=null,
        reviewed_at=null,
        reviewed_by_staff_id=null,
        updated_at=now()
    where id=v_row.id
    returning * into v_row;
  else
    insert into public.staff_applications(
      applicant_user_id, requested_role, full_name, email, phone, national_id,
      specialization, experience_years, licenses, applicant_notes
    )
    values(
      v_uid, p_requested_role, trim(p_full_name), v_email, trim(p_phone),
      nullif(trim(coalesce(p_national_id,'')), ''),
      nullif(trim(coalesce(p_specialization,'')), ''),
      p_experience_years, coalesce(p_licenses,'{}'),
      nullif(trim(coalesce(p_applicant_notes,'')), '')
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.create_or_update_staff_application(
  p_requested_role text,
  p_full_name text,
  p_phone text,
  p_national_id text default null,
  p_specialization text default null,
  p_experience_years integer default null,
  p_licenses text[] default '{}',
  p_applicant_notes text default null
)
returns public.staff_applications
language sql
set search_path=''
as $$
  select internal.create_or_update_staff_application($1,$2,$3,$4,$5,$6,$7,$8);
$$;

create or replace function internal.submit_staff_application(p_application_id uuid)
returns public.staff_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.staff_applications;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_row
  from public.staff_applications
  where id=p_application_id and applicant_user_id=v_uid
  for update;

  if not found then raise exception 'Application not found' using errcode='42501'; end if;
  if v_row.status not in ('draft','needs_info') then raise exception 'Application cannot be submitted'; end if;

  update public.staff_applications
  set status='pending', submitted_at=now(), updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_staff_application(p_application_id uuid)
returns public.staff_applications
language sql
set search_path=''
as $$
  select internal.submit_staff_application($1);
$$;

create or replace function public.review_staff_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.staff_applications
language plpgsql
set search_path=''
as $$
declare
  v_staff_id text;
  v_row public.staff_applications;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if p_status not in ('needs_info','rejected') then
    raise exception 'Invalid review status';
  end if;

  select id into v_staff_id
  from public.staff
  where user_id=(select auth.uid()) and role='manager' and status='active'
  limit 1;

  select * into v_row
  from public.staff_applications
  where id=p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending applications can be reviewed'; end if;

  update public.staff_applications
  set status=p_status,
      review_notes=nullif(trim(coalesce(p_notes,'')), ''),
      reviewed_at=now(),
      reviewed_by_staff_id=v_staff_id,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function internal.approve_staff_application(p_application_id uuid)
returns public.staff_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  v_manager_id text;
  v_row public.staff_applications;
  v_staff_id text;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  select id into v_manager_id
  from public.staff
  where user_id=(select auth.uid()) and role='manager' and status='active'
  limit 1;

  select * into v_row
  from public.staff_applications
  where id=p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending applications can be approved'; end if;
  if exists(select 1 from public.staff where user_id=v_row.applicant_user_id) then
    raise exception 'Staff account already exists';
  end if;
  if exists(select 1 from public.staff where lower(email)=lower(v_row.email)) then
    raise exception 'Staff email already exists';
  end if;

  v_staff_id := 'staff-' || gen_random_uuid()::text;

  insert into public.staff(
    id,user_id,name,email,phone,role,salary,specialization,status,joined_date,
    avatar_url,national_id,licenses,experience_years,rating,tactical_style,notes
  )
  values(
    v_staff_id,v_row.applicant_user_id,v_row.full_name,v_row.email,v_row.phone,
    v_row.requested_role,0,coalesce(v_row.specialization,''),'active',current_date,
    '',v_row.national_id,v_row.licenses,v_row.experience_years,null,null,v_row.applicant_notes
  );

  update public.staff_applications
  set status='approved',
      reviewed_at=now(),
      reviewed_by_staff_id=v_manager_id,
      approved_staff_id=v_staff_id,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.approve_staff_application(p_application_id uuid)
returns public.staff_applications
language sql
set search_path=''
as $$
  select internal.approve_staff_application($1);
$$;

revoke all on function internal.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) from public, anon;
revoke all on function internal.submit_staff_application(uuid) from public, anon;
revoke all on function internal.approve_staff_application(uuid) from public, anon;

revoke all on function public.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) from public, anon;
revoke all on function public.submit_staff_application(uuid) from public, anon;
revoke all on function public.review_staff_application(uuid,text,text) from public, anon;
revoke all on function public.approve_staff_application(uuid) from public, anon;

grant execute on function public.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) to authenticated;
grant execute on function public.submit_staff_application(uuid) to authenticated;
grant execute on function public.review_staff_application(uuid,text,text) to authenticated;
grant execute on function public.approve_staff_application(uuid) to authenticated;
