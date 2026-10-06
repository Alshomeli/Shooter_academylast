create table if not exists public.registration_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid null references auth.users(id) on delete set null,
  parent_full_name text not null,
  parent_national_id text not null,
  parent_phone text not null,
  parent_whatsapp text null,
  parent_email text not null,
  parent_nationality text null,
  parent_occupation text null,
  parent_workplace text null,
  parent_address text null,
  parent_notes text null,
  status text not null default 'pending',
  review_notes text null,
  reviewed_at timestamptz null,
  reviewed_by_staff_id text null references public.staff(id) on delete set null,
  approved_parent_id text null references public.parents(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_registration_application_status check (status in ('pending','under_review','needs_info','approved','rejected')),
  constraint chk_registration_parent_name check (length(trim(parent_full_name)) >= 2),
  constraint chk_registration_parent_cpr check (length(trim(parent_national_id)) > 0),
  constraint chk_registration_parent_phone check (length(trim(parent_phone)) > 0),
  constraint chk_registration_parent_email check (position('@' in parent_email) > 1)
);

create table if not exists public.registration_children (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.registration_applications(id) on delete cascade,
  full_name text not null,
  national_id text not null,
  birth_date date not null,
  blood_type text null,
  parent_notes text null,
  approved_player_id text null references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chk_registration_child_name check (length(trim(full_name)) >= 2),
  constraint chk_registration_child_cpr check (length(trim(national_id)) > 0),
  constraint chk_registration_child_birth_date check (birth_date <= current_date)
);

create table if not exists public.registration_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.registration_applications(id) on delete cascade,
  child_id uuid null references public.registration_children(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_category text not null default 'document',
  document_type text not null default 'other',
  file_size bigint not null default 0,
  approved_player_id text null references public.players(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint chk_registration_document_category check (file_category in ('photo','document')),
  constraint chk_registration_document_size check (file_size >= 0),
  constraint chk_registration_photo_mime check (
    file_category <> 'photo' or mime_type in ('image/jpeg','image/png','image/webp')
  ),
  constraint chk_registration_photo_child check (
    file_category <> 'photo' or child_id is not null
  )
);

create unique index if not exists uq_registration_child_cpr_per_application
  on public.registration_children (application_id, lower(trim(national_id)));
create index if not exists idx_registration_applications_status_created
  on public.registration_applications (status, created_at desc);
create index if not exists idx_registration_applications_applicant
  on public.registration_applications (applicant_user_id) where applicant_user_id is not null;
create index if not exists idx_registration_children_application
  on public.registration_children (application_id);
create index if not exists idx_registration_children_national_id
  on public.registration_children (lower(trim(national_id)));
create index if not exists idx_registration_documents_application
  on public.registration_documents (application_id);
create index if not exists idx_registration_documents_child
  on public.registration_documents (child_id) where child_id is not null;
create unique index if not exists uq_registration_child_profile_photo
  on public.registration_documents (child_id) where file_category = 'photo' and child_id is not null;
create unique index if not exists uq_registration_document_storage_path
  on public.registration_documents (storage_path);

alter table public.registration_applications enable row level security;
alter table public.registration_children enable row level security;
alter table public.registration_documents enable row level security;

revoke all on public.registration_applications from anon, authenticated;
revoke all on public.registration_children from anon, authenticated;
revoke all on public.registration_documents from anon, authenticated;

grant select, update on public.registration_applications to authenticated;
grant select on public.registration_children to authenticated;
grant select on public.registration_documents to authenticated;
grant all on public.registration_applications to service_role;
grant all on public.registration_children to service_role;
grant all on public.registration_documents to service_role;

create policy registration_applications_select_authorized
on public.registration_applications
for select to authenticated
using (
  (select internal.is_academy_admin())
  or (applicant_user_id is not null and applicant_user_id = (select auth.uid()))
);

create policy registration_applications_update_manager
on public.registration_applications
for update to authenticated
using ((select internal.is_academy_admin()))
with check ((select internal.is_academy_admin()));

create policy registration_children_select_authorized
on public.registration_children
for select to authenticated
using (
  (select internal.is_academy_admin())
  or exists (
    select 1 from public.registration_applications a
    where a.id = registration_children.application_id
      and a.applicant_user_id = (select auth.uid())
  )
);

create policy registration_documents_select_authorized
on public.registration_documents
for select to authenticated
using (
  (select internal.is_academy_admin())
  or exists (
    select 1 from public.registration_applications a
    where a.id = registration_documents.application_id
      and a.applicant_user_id = (select auth.uid())
  )
);

create or replace function internal.notify_managers_new_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    id, title, message, timestamp, type, read, recipient_user_id
  )
  select
    'notif-' || gen_random_uuid()::text,
    'طلب تسجيل جديد',
    'تم استلام طلب تسجيل جديد من ولي الأمر: ' || new.parent_full_name,
    now()::text,
    'registration',
    false,
    s.user_id
  from public.staff s
  where s.role = 'manager'
    and s.status = 'active'
    and s.user_id is not null;
  return new;
end;
$$;
revoke execute on function internal.notify_managers_new_registration() from public, anon, authenticated;

drop trigger if exists trg_notify_managers_new_registration on public.registration_applications;
create trigger trg_notify_managers_new_registration
after insert on public.registration_applications
for each row execute function internal.notify_managers_new_registration();

create or replace function public.review_registration_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.registration_applications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.registration_applications%rowtype;
  v_staff_id text;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode = '42501';
  end if;

  if p_status not in ('under_review','needs_info','rejected') then
    raise exception 'Invalid review status';
  end if;

  select s.id into v_staff_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.role = 'manager'
    and s.status = 'active'
  limit 1;

  select * into v_row
  from public.registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Registration application not found';
  end if;
  if v_row.status in ('approved','rejected') then
    raise exception 'Registration application is already finalized';
  end if;

  update public.registration_applications
  set status = p_status,
      review_notes = nullif(trim(coalesce(p_notes,'')),''),
      reviewed_at = now(),
      reviewed_by_staff_id = v_staff_id,
      updated_at = now()
  where id = p_application_id
  returning * into v_row;

  if v_row.applicant_user_id is not null then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values (
      'notif-' || gen_random_uuid()::text,
      case p_status when 'needs_info' then 'طلب التسجيل يحتاج استكمال' when 'rejected' then 'تم تحديث طلب التسجيل' else 'طلب التسجيل قيد المراجعة' end,
      case p_status when 'needs_info' then 'يرجى مراجعة طلب التسجيل واستكمال البيانات المطلوبة.' when 'rejected' then 'تم رفض طلب التسجيل. يمكنك التواصل مع الأكاديمية لمزيد من التفاصيل.' else 'طلب التسجيل قيد المراجعة من الإدارة.' end,
      now()::text,
      'registration', false, v_row.applicant_user_id
    );
  end if;

  return v_row;
end;
$$;
revoke execute on function public.review_registration_application(uuid,text,text) from public, anon;
grant execute on function public.review_registration_application(uuid,text,text) to authenticated;

create or replace function public.approve_registration_application(p_application_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_app public.registration_applications%rowtype;
  v_child public.registration_children%rowtype;
  v_parent_id text;
  v_existing_parent_user_id uuid;
  v_player_id text;
  v_staff_id text;
  v_players jsonb := '[]'::jsonb;
  v_existing_player_id text;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode = '42501';
  end if;

  select s.id into v_staff_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.role = 'manager'
    and s.status = 'active'
  limit 1;

  select * into v_app
  from public.registration_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Registration application not found'; end if;
  if v_app.status in ('approved','rejected') then raise exception 'Registration application is already finalized'; end if;

  if nullif(trim(v_app.parent_full_name),'') is null
     or nullif(trim(v_app.parent_national_id),'') is null
     or nullif(trim(v_app.parent_phone),'') is null
     or nullif(trim(v_app.parent_email),'') is null then
    raise exception 'Parent required information is incomplete';
  end if;

  if not exists (select 1 from public.registration_children c where c.application_id = p_application_id) then
    raise exception 'At least one child is required';
  end if;

  if exists (
    select 1
    from public.registration_children c
    where c.application_id = p_application_id
      and not exists (
        select 1 from public.registration_documents d
        where d.child_id = c.id and d.file_category = 'photo'
      )
  ) then
    raise exception 'Every child must have a profile photo before approval';
  end if;

  select pp.id into v_parent_id
  from public.get_parent_private() pp
  where lower(trim(pp.national_id)) = lower(trim(v_app.parent_national_id))
  limit 1;

  if v_parent_id is null then
    v_parent_id := 'parent-' || gen_random_uuid()::text;
    insert into public.parents(
      id,name,national_id,nationality,phone,whatsapp_phone,email,address,occupation,workplace,status,notes,joined_date,user_id
    ) values (
      v_parent_id,
      trim(v_app.parent_full_name),
      trim(v_app.parent_national_id),
      coalesce(trim(v_app.parent_nationality),''),
      trim(v_app.parent_phone),
      coalesce(nullif(trim(coalesce(v_app.parent_whatsapp,'')),''),trim(v_app.parent_phone)),
      lower(trim(v_app.parent_email)),
      coalesce(trim(v_app.parent_address),''),
      coalesce(trim(v_app.parent_occupation),''),
      coalesce(trim(v_app.parent_workplace),''),
      'active',
      coalesce(v_app.parent_notes,''),
      current_date,
      v_app.applicant_user_id
    );
  else
    select p.user_id into v_existing_parent_user_id from public.parents p where p.id = v_parent_id;
    if v_app.applicant_user_id is not null and v_existing_parent_user_id is not null and v_existing_parent_user_id <> v_app.applicant_user_id then
      raise exception 'Existing parent CPR is linked to another login account';
    end if;
    update public.parents
    set name = trim(v_app.parent_full_name),
        phone = trim(v_app.parent_phone),
        whatsapp_phone = coalesce(nullif(trim(coalesce(v_app.parent_whatsapp,'')),''),trim(v_app.parent_phone)),
        email = lower(trim(v_app.parent_email)),
        nationality = coalesce(trim(v_app.parent_nationality),nationality),
        address = coalesce(trim(v_app.parent_address),address),
        occupation = coalesce(trim(v_app.parent_occupation),occupation),
        workplace = coalesce(trim(v_app.parent_workplace),workplace),
        notes = coalesce(v_app.parent_notes,notes),
        user_id = coalesce(user_id,v_app.applicant_user_id)
    where id = v_parent_id;
  end if;

  for v_child in
    select * from public.registration_children c
    where c.application_id = p_application_id
    order by c.created_at, c.id
  loop
    if nullif(trim(v_child.national_id),'') is null then
      raise exception 'Child CPR is required';
    end if;

    select pi.id into v_existing_player_id
    from public.get_player_identity_private() pi
    where lower(trim(pi.national_id)) = lower(trim(v_child.national_id))
    limit 1;

    if v_existing_player_id is not null then
      raise exception 'A player with this CPR already exists';
    end if;

    v_player_id := 'player-' || gen_random_uuid()::text;
    insert into public.players(
      id,name,national_id,birth_date,blood_type,jersey_number,position,team_id,
      parent_name,parent_phone,parent_email,parent_id,status,notes,joined_date
    ) values (
      v_player_id,
      trim(v_child.full_name),
      trim(v_child.national_id),
      v_child.birth_date,
      coalesce(trim(v_child.blood_type),''),
      0,
      '',
      null,
      trim(v_app.parent_full_name),
      trim(v_app.parent_phone),
      lower(trim(v_app.parent_email)),
      v_parent_id,
      'inactive',
      coalesce(v_child.parent_notes,''),
      current_date
    );

    update public.registration_children
    set approved_player_id = v_player_id
    where id = v_child.id;

    update public.registration_documents
    set approved_player_id = v_player_id
    where child_id = v_child.id;

    v_players := v_players || jsonb_build_array(jsonb_build_object('childId',v_child.id,'playerId',v_player_id));
  end loop;

  update public.registration_applications
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by_staff_id = v_staff_id,
      approved_parent_id = v_parent_id,
      updated_at = now()
  where id = p_application_id;

  if v_app.applicant_user_id is not null then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values (
      'notif-' || gen_random_uuid()::text,
      'تمت الموافقة على طلب التسجيل',
      'تمت الموافقة على طلب التسجيل وسيتم استكمال التوزيع الداخلي من إدارة الأكاديمية.',
      now()::text,
      'registration', false, v_app.applicant_user_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'applicationId', p_application_id,
    'parentId', v_parent_id,
    'players', v_players,
    'nextStep', 'assign_team_position_jersey_then_activate'
  );
end;
$$;
revoke execute on function public.approve_registration_application(uuid) from public, anon;
grant execute on function public.approve_registration_application(uuid) to authenticated;

