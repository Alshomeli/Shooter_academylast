alter table public.registration_applications
  alter column status set default 'draft',
  alter column submitted_at drop not null,
  alter column submitted_at drop default;

alter table public.registration_applications drop constraint if exists chk_registration_application_status;
alter table public.registration_applications add constraint chk_registration_application_status
  check (status in ('draft','pending','under_review','needs_info','approved','rejected'));

create or replace function internal.notify_managers_new_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
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
  end if;
  return new;
end;
$$;
revoke execute on function internal.notify_managers_new_registration() from public, anon, authenticated;

drop trigger if exists trg_notify_managers_new_registration on public.registration_applications;
create trigger trg_notify_managers_new_registration
after insert or update of status on public.registration_applications
for each row execute function internal.notify_managers_new_registration();

create or replace function internal.create_registration_draft(p_parent jsonb, p_children jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;

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
    parent_workplace, parent_address, parent_notes, status, submitted_at
  ) values (
    v_app_id, v_uid, v_parent_name, v_parent_cpr, v_parent_phone,
    nullif(trim(coalesce(p_parent->>'whatsapp','')),''), v_parent_email,
    nullif(trim(coalesce(p_parent->>'nationality','')),''),
    nullif(trim(coalesce(p_parent->>'occupation','')),''),
    nullif(trim(coalesce(p_parent->>'workplace','')),''),
    nullif(trim(coalesce(p_parent->>'address','')),''),
    nullif(trim(coalesce(p_parent->>'notes','')),''),
    'draft', null
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

  return jsonb_build_object('applicationId',v_app_id,'status','draft','children',v_children_result);
end;
$$;
revoke execute on function internal.create_registration_draft(jsonb,jsonb) from public, anon;
grant execute on function internal.create_registration_draft(jsonb,jsonb) to authenticated;

create or replace function public.create_registration_draft(p_parent jsonb, p_children jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal.create_registration_draft(p_parent,p_children)
$$;
revoke execute on function public.create_registration_draft(jsonb,jsonb) from public, anon;
grant execute on function public.create_registration_draft(jsonb,jsonb) to authenticated;

create or replace function internal.add_registration_document(
  p_application_id uuid,
  p_child_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_category text,
  p_document_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  v_is_manager boolean := (select internal.is_academy_admin());
  v_status text;
begin
  select a.status into v_status
  from public.registration_applications a
  where a.id = p_application_id
    and (v_is_manager or a.applicant_user_id = v_uid);
  if not found then raise exception 'Registration application not found or access denied' using errcode='42501'; end if;
  if not v_is_manager and v_status not in ('draft','needs_info') then raise exception 'Registration files can no longer be changed'; end if;

  if p_child_id is not null and not exists (
    select 1 from public.registration_children c
    where c.id = p_child_id and c.application_id = p_application_id
  ) then raise exception 'Child does not belong to the registration application'; end if;

  if p_child_id is null then
    if p_storage_path not like 'applications/' || p_application_id::text || '/parent/%' then raise exception 'Invalid parent document path'; end if;
  else
    if p_storage_path not like 'applications/' || p_application_id::text || '/' || p_child_id::text || '/%' then raise exception 'Invalid child document path'; end if;
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id='player-documents' and o.name=p_storage_path
  ) then raise exception 'Uploaded storage object was not found'; end if;

  insert into public.registration_documents(
    id,application_id,child_id,storage_path,file_name,mime_type,file_category,document_type,file_size
  ) values (
    v_id,p_application_id,p_child_id,p_storage_path,p_file_name,p_mime_type,p_file_category,
    coalesce(nullif(trim(p_document_type),''),'other'),greatest(coalesce(p_file_size,0),0)
  );
  return v_id;
end;
$$;
revoke execute on function internal.add_registration_document(uuid,uuid,text,text,text,text,text,bigint) from public, anon;
grant execute on function internal.add_registration_document(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.add_registration_document(
  p_application_id uuid,
  p_child_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_category text,
  p_document_type text,
  p_file_size bigint
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal.add_registration_document(p_application_id,p_child_id,p_storage_path,p_file_name,p_mime_type,p_file_category,p_document_type,p_file_size)
$$;
revoke execute on function public.add_registration_document(uuid,uuid,text,text,text,text,text,bigint) from public, anon;
grant execute on function public.add_registration_document(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function internal.submit_registration_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.registration_applications%rowtype;
  v_child_count int;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select * into v_app
  from public.registration_applications a
  where a.id=p_application_id and a.applicant_user_id=v_uid
  for update;
  if not found then raise exception 'Registration application not found or access denied' using errcode='42501'; end if;
  if v_app.status not in ('draft','needs_info') then raise exception 'Registration application cannot be submitted from its current status'; end if;

  select count(*) into v_child_count from public.registration_children c where c.application_id=p_application_id;
  if v_child_count < 1 then raise exception 'At least one child is required'; end if;

  if exists (
    select 1 from public.registration_children c
    where c.application_id=p_application_id
      and not exists (
        select 1 from public.registration_documents d
        where d.child_id=c.id and d.file_category='photo'
      )
  ) then raise exception 'Every child must have a profile photo before submission'; end if;

  update public.registration_applications
  set status='pending', submitted_at=now(), updated_at=now(), review_notes=null
  where id=p_application_id;

  return jsonb_build_object('success',true,'applicationId',p_application_id,'status','pending','childrenCount',v_child_count);
end;
$$;
revoke execute on function internal.submit_registration_application(uuid) from public, anon;
grant execute on function internal.submit_registration_application(uuid) to authenticated;

create or replace function public.submit_registration_application(p_application_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal.submit_registration_application(p_application_id)
$$;
revoke execute on function public.submit_registration_application(uuid) from public, anon;
grant execute on function public.submit_registration_application(uuid) to authenticated;

create policy registration_storage_insert_applicant
on storage.objects
for insert to authenticated
with check (
  bucket_id='player-documents'
  and (storage.foldername(name))[1]='applications'
  and exists (
    select 1
    from public.registration_applications a
    where a.id::text=(storage.foldername(name))[2]
      and a.applicant_user_id=(select auth.uid())
      and a.status in ('draft','needs_info')
      and (
        (storage.foldername(name))[3]='parent'
        or exists (
          select 1 from public.registration_children c
          where c.application_id=a.id
            and c.id::text=(storage.foldername(name))[3]
        )
      )
  )
);

create policy registration_storage_select_authorized
on storage.objects
for select to authenticated
using (
  bucket_id='player-documents'
  and (storage.foldername(name))[1]='applications'
  and exists (
    select 1 from public.registration_applications a
    where a.id::text=(storage.foldername(name))[2]
      and ((select internal.is_academy_admin()) or a.applicant_user_id=(select auth.uid()))
  )
);

create policy registration_storage_delete_applicant_or_manager
on storage.objects
for delete to authenticated
using (
  bucket_id='player-documents'
  and (storage.foldername(name))[1]='applications'
  and exists (
    select 1 from public.registration_applications a
    where a.id::text=(storage.foldername(name))[2]
      and (
        (select internal.is_academy_admin())
        or (a.applicant_user_id=(select auth.uid()) and a.status in ('draft','needs_info'))
      )
  )
);

