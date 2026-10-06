-- Integration repair. No legacy/test payments or registrations are rewritten.
-- Apply after the registration migrations exported from the linked project.
create or replace function internal.bump_row_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end $$;
revoke all on function internal.bump_row_version() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['staff','teams','players','parents','subscriptions',
    'attendance','matches','trainings','transactions','tournaments','videos',
    'notifications','academy_settings'] loop
    execute format('alter table public.%I add column if not exists row_version bigint not null default 0', t);
    execute format('drop trigger if exists trg_bump_row_version on public.%I', t);
    execute format('create trigger trg_bump_row_version before update on public.%I for each row execute function internal.bump_row_version()', t);
  end loop;
end $$;
grant select (row_version) on public.staff, public.parents, public.players to authenticated;

-- Linked parent data is authoritative, including during administrative edits.
create or replace function internal.copy_player_parent_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.parents%rowtype;
begin
  if new.parent_id is not null then
    select * into p from public.parents where id = new.parent_id;
    if not found then raise exception 'Parent not found'; end if;
    new.parent_name := p.name;
    new.parent_phone := p.phone;
    new.parent_email := p.email;
  end if;
  return new;
end $$;
drop trigger if exists aa_copy_player_parent_contact on public.players;
create trigger aa_copy_player_parent_contact before insert or update of parent_id, parent_name, parent_phone, parent_email
on public.players for each row execute function internal.copy_player_parent_contact();

create or replace function internal.guard_player_sensitive_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if internal.is_academy_admin() is not true then
    if new.parent_id is distinct from old.parent_id or new.team_id is distinct from old.team_id then
      raise exception 'Only managers can change a player parent or team' using errcode = '42501';
    end if;
    if new.parent_email is distinct from old.parent_email and not exists (
      select 1 from public.parents p where p.id = new.parent_id and p.email = new.parent_email
    ) then
      raise exception 'Only managers can modify parent_email' using errcode = '42501';
    end if;
    if new.notes is distinct from old.notes then
      raise exception 'Only managers can modify private player notes' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function internal.sync_parent_contact_to_players()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.players set parent_name = new.name, parent_phone = new.phone, parent_email = new.email
    where parent_id = new.id and (parent_name, parent_phone, parent_email)
      is distinct from (new.name, new.phone, new.email);
  return new;
end $$;
drop trigger if exists trg_sync_parent_contact on public.parents;
create trigger trg_sync_parent_contact after update of name, phone, email on public.parents
for each row execute function internal.sync_parent_contact_to_players();

create or replace function internal.guard_parent_private_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.national_id is distinct from old.national_id and internal.is_academy_admin() is not true then
    raise exception 'Only managers can modify parent national ID' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_parent_private_fields on public.parents;
create trigger trg_guard_parent_private_fields before update on public.parents
for each row execute function internal.guard_parent_private_fields();

-- Both sides of a posted payment become immutable financial records.
create or replace function internal.guard_paid_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.transactions where subscription_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'A paid subscription with a transaction cannot be deleted';
    end if;
    if (new.id, new.player_id, new.amount, new.status, new.payment_method, new.paid_at,
        new.plan_type, new.start_date, new.end_date)
       is distinct from
       (old.id, old.player_id, old.amount, old.status, old.payment_method, old.paid_at,
        old.plan_type, old.start_date, old.end_date) then
      raise exception 'Posted subscription payment cannot be changed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists trg_guard_paid_subscription on public.subscriptions;
create trigger trg_guard_paid_subscription before update or delete on public.subscriptions
for each row execute function internal.guard_paid_subscription();

create or replace function internal.guard_posted_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.subscription_id is not null then
    if tg_op = 'DELETE' then raise exception 'Posted subscription transaction cannot be deleted'; end if;
    if (new.id, new.type, new.category, new.amount, new.transaction_date, new.recorded_by,
        new.subscription_id, new.player_id) is distinct from
       (old.id, old.type, old.category, old.amount, old.transaction_date, old.recorded_by,
        old.subscription_id, old.player_id) then
      raise exception 'Posted subscription transaction cannot be changed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.type = 'revenue' and lower(trim(new.category)) = 'subscription' and new.subscription_id is null
     and (tg_op = 'INSERT' or (new.type, new.category) is distinct from (old.type, old.category)) then
    raise exception 'Use record_subscription_payment for subscription revenue';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_posted_transaction on public.transactions;
create trigger trg_guard_posted_transaction before insert or update or delete on public.transactions
for each row execute function internal.guard_posted_transaction();

create or replace function internal.require_payment_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions%rowtype;
begin
  if tg_op = 'UPDATE' and (new.status, new.amount, new.player_id, new.payment_method, new.paid_at)
    is not distinct from (old.status, old.amount, old.player_id, old.payment_method, old.paid_at) then
    return null;
  end if;
  select * into s from public.subscriptions where id = new.id;
  if found and s.status = 'paid' and not exists (
    select 1 from public.transactions t where t.subscription_id = s.id
      and t.player_id = s.player_id and t.amount = s.amount
      and t.type = 'revenue' and t.category = 'subscription'
  ) then
    raise exception 'A paid subscription requires its linked payment transaction';
  end if;
  return null;
end $$;
drop trigger if exists trg_require_payment_transaction on public.subscriptions;
create constraint trigger trg_require_payment_transaction after insert or update on public.subscriptions
 deferrable initially deferred for each row execute function internal.require_payment_transaction();

-- Preserve the public RPC signature. Typed dates, fail-closed authorization,
-- a row lock, and the unique subscription transaction index make retries safe.
create or replace function internal.record_subscription_payment(
  p_subscription_id text, p_amount numeric, p_payment_method text,
  p_transaction_date text default null, p_description text default null
) returns public.transactions language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions%rowtype;
  v_txn public.transactions%rowtype;
  v_role text;
  v_date date;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_role := internal.current_user_role();
  if v_role is null or v_role not in ('manager', 'accountant') then
    raise exception 'Only manager or accountant can record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if nullif(trim(p_payment_method), '') is null then raise exception 'Payment method is required'; end if;
  if nullif(trim(p_transaction_date), '') is not null and p_transaction_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Payment date must use YYYY-MM-DD';
  end if;
  v_date := coalesce(nullif(trim(p_transaction_date), '')::date, current_date);
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'Subscription not found'; end if;
  if p_amount <> v_sub.amount then raise exception 'Payment amount must equal subscription amount'; end if;
  if v_sub.status = 'paid' then
    select * into v_txn from public.transactions where subscription_id = v_sub.id;
    if found and v_txn.amount = p_amount and v_txn.player_id = v_sub.player_id
       and v_sub.payment_method = trim(p_payment_method)
       and (p_transaction_date is null or v_txn.transaction_date = v_date) then
      return v_txn;
    end if;
    raise exception 'Subscription is already paid; review its existing payment';
  end if;
  update public.subscriptions set status = 'paid', payment_method = trim(p_payment_method), paid_at = now()
    where id = v_sub.id;
  insert into public.transactions(id, type, category, amount, transaction_date, description, recorded_by, subscription_id, player_id)
  values ('txn-' || gen_random_uuid()::text, 'revenue', 'subscription', p_amount, v_date,
    coalesce(nullif(trim(p_description), ''), 'سداد اشتراك ' || v_sub.id),
    coalesce((select name from public.staff where user_id = auth.uid() and status = 'active' limit 1), ''),
    v_sub.id, v_sub.player_id) returning * into v_txn;
  return v_txn;
end $$;

revoke all on function internal.copy_player_parent_contact(), internal.guard_player_sensitive_columns(),
 internal.sync_parent_contact_to_players(), internal.guard_parent_private_fields(), internal.guard_paid_subscription(),
 internal.guard_posted_transaction(), internal.require_payment_transaction() from public, anon, authenticated;
revoke all on function internal.record_subscription_payment(text,numeric,text,text,text) from public, anon, service_role;
grant execute on function internal.record_subscription_payment(text,numeric,text,text,text) to authenticated;
notify pgrst, 'reload schema';

-- Restricted-column access stays behind a strict manager check.
create or replace function internal.approve_registration_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
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
  if (select internal.is_academy_admin()) is not true then
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
  if v_app.status not in ('pending','under_review') then raise exception 'Only submitted applications can be approved'; end if;

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
create or replace function public.approve_registration_application(p_application_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select internal.approve_registration_application(p_application_id) $$;
revoke all on function internal.approve_registration_application(uuid), public.approve_registration_application(uuid) from public, anon, service_role;
grant execute on function internal.approve_registration_application(uuid), public.approve_registration_application(uuid) to authenticated;

-- Restricted-column access stays behind a strict manager check.
create or replace function internal.finalize_registered_player(
  p_player_id text,
  p_team_id text,
  p_position text,
  p_jersey_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players%rowtype;
  v_team public.teams%rowtype;
  v_applicant_user_id uuid;
begin
  if (select internal.is_academy_admin()) is not true then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_team_id,'')),'') is null then raise exception 'Team is required'; end if;
  if nullif(trim(coalesce(p_position,'')),'') is null then raise exception 'Player position is required'; end if;
  if p_jersey_number is null or p_jersey_number <= 0 then raise exception 'Jersey number must be greater than zero'; end if;

  select * into v_player from public.players p where p.id=p_player_id for update;
  if not found then raise exception 'Player not found'; end if;

  if nullif(trim(coalesce(v_player.national_id,'')),'') is null then
    raise exception 'Player CPR is required before activation';
  end if;

  if not exists (
    select 1 from public.registration_children c
    join public.registration_applications a on a.id=c.application_id
    where c.approved_player_id=p_player_id and a.status='approved'
  ) then
    raise exception 'Player is not linked to an approved registration application';
  end if;

  if not (
    exists (
      select 1 from public.registration_documents d
      where d.approved_player_id=p_player_id and d.file_category='photo'
    )
    or exists (
      select 1 from public.player_documents d
      where d.player_id=p_player_id and d.file_category='photo'
    )
  ) then
    raise exception 'Player profile photo is required before activation';
  end if;

  select * into v_team from public.teams t where t.id=p_team_id;
  if not found then raise exception 'Selected team does not exist'; end if;

  if exists (
    select 1 from public.players p
    where p.team_id=p_team_id
      and p.jersey_number=p_jersey_number
      and p.id<>p_player_id
  ) then
    raise exception 'Jersey number is already used in the selected team';
  end if;

  update public.players
  set team_id=p_team_id,
      position=trim(p_position),
      jersey_number=p_jersey_number,
      status='active'
  where id=p_player_id
  returning * into v_player;

  select a.applicant_user_id into v_applicant_user_id
  from public.registration_children c
  join public.registration_applications a on a.id=c.application_id
  where c.approved_player_id=p_player_id
  limit 1;

  if v_applicant_user_id is not null then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values (
      'notif-' || gen_random_uuid()::text,
      'تم استكمال تسجيل اللاعب',
      'تم استكمال التوزيع الداخلي وتفعيل اللاعب في الأكاديمية.',
      now()::text,
      'registration',false,v_applicant_user_id
    );
  end if;

  return jsonb_build_object(
    'success',true,
    'playerId',v_player.id,
    'teamId',v_player.team_id,
    'position',v_player.position,
    'jerseyNumber',v_player.jersey_number,
    'status',v_player.status,
    'pitchNumber',v_team.pitch_number
  );
end;
$$;
create or replace function public.finalize_registered_player(p_player_id text, p_team_id text, p_position text, p_jersey_number integer) returns jsonb language sql security invoker set search_path = '' as $$ select internal.finalize_registered_player(p_player_id,p_team_id,p_position,p_jersey_number) $$;
revoke all on function internal.finalize_registered_player(text,text,text,integer), public.finalize_registered_player(text,text,text,integer) from public, anon, service_role;
grant execute on function internal.finalize_registered_player(text,text,text,integer), public.finalize_registered_player(text,text,text,integer) to authenticated;

alter table public.registration_applications add column if not exists request_id uuid;
alter table public.registration_children add column if not exists client_key text;
create unique index if not exists uq_registration_request on public.registration_applications(applicant_user_id, request_id) where request_id is not null;

create or replace function internal.create_registration_draft(p_parent jsonb, p_children jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid := nullif(p_parent->>'requestId','')::uuid;
  v_existing uuid;
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

  select lower(u.email) into v_auth_email from auth.users u where u.id = v_uid;
  if v_auth_email is null then raise exception 'Authenticated email is required'; end if;
  if v_parent_email <> v_auth_email then raise exception 'Registration email must match the authenticated account email'; end if;
  if v_registration_type not in ('initial_onboarding','new_application') then raise exception 'Invalid registration type'; end if;
  if length(v_parent_name) < 2 then raise exception 'Parent name is required'; end if;
  if v_parent_cpr = '' then raise exception 'Parent CPR is required'; end if;
  if v_parent_phone = '' then raise exception 'Parent phone is required'; end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) < 1 then raise exception 'At least one child is required'; end if;

  if v_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text || v_request_id::text, 0));
    select id into v_existing from public.registration_applications where applicant_user_id = v_uid and request_id = v_request_id;
    if found then
      return jsonb_build_object('applicationId',v_existing,'status',(select status from public.registration_applications where id=v_existing),'registrationType',(select registration_type from public.registration_applications where id=v_existing),'children',(
        select coalesce(jsonb_agg(jsonb_build_object('clientKey',client_key,'childId',id,'fullName',full_name)),'[]')
        from public.registration_children where application_id=v_existing));
    end if;
  end if;
  insert into public.registration_applications(
    id, request_id, applicant_user_id, parent_full_name, parent_national_id, parent_phone,
    parent_whatsapp, parent_email, parent_nationality, parent_occupation,
    parent_workplace, parent_address, parent_notes, status, submitted_at, registration_type
  ) values (
    v_app_id, v_request_id, v_uid, v_parent_name, v_parent_cpr, v_parent_phone,
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
      id, client_key, application_id, full_name, national_id, birth_date, blood_type, parent_notes
    ) values (
      v_child_id, v_child->>'clientKey', v_app_id,
      trim(v_child->>'fullName'), trim(v_child->>'nationalId'), (v_child->>'birthDate')::date,
      nullif(trim(coalesce(v_child->>'bloodType','')),''),
      nullif(trim(coalesce(v_child->>'notes','')),'')
    );

    v_children_result := v_children_result || jsonb_build_array(
      jsonb_build_object('clientKey',v_child->>'clientKey','childId',v_child_id,'fullName',trim(v_child->>'fullName'))
    );
  end loop;

  return jsonb_build_object('applicationId',v_app_id,'status','draft','registrationType',v_registration_type,'children',v_children_result);
end;
$$;

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
    and (v_is_manager or a.applicant_user_id = v_uid) for update;
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

  select id into v_id from public.registration_documents
    where application_id=p_application_id and storage_path=p_storage_path;
  if found then return v_id; end if;
  v_id := gen_random_uuid();
  if p_file_category = 'photo' then
    delete from public.registration_documents where application_id=p_application_id and child_id=p_child_id and file_category='photo';
  end if;
  insert into public.registration_documents(
    id,application_id,child_id,storage_path,file_name,mime_type,file_category,document_type,file_size
  ) values (
    v_id,p_application_id,p_child_id,p_storage_path,p_file_name,p_mime_type,p_file_category,
    coalesce(nullif(trim(p_document_type),''),'other'),greatest(coalesce(p_file_size,0),0)
  );
  return v_id;
end;
$$;

-- Edit an owned draft/needs-info application without replacing children/documents.
create or replace function internal.update_registration_draft(p_application_id uuid, p_parent jsonb, p_children jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.registration_applications%rowtype; c jsonb;
begin
  select * into a from public.registration_applications where id=p_application_id and applicant_user_id=auth.uid() for update;
  if not found then raise exception 'Registration access denied' using errcode='42501'; end if;
  if a.status not in ('draft','needs_info') then raise exception 'Application cannot be changed after submission'; end if;
  if lower(trim(p_parent->>'email')) is distinct from (select lower(email) from auth.users where id=auth.uid()) then
    raise exception 'Registration email must match the authenticated account email';
  end if;
  if jsonb_typeof(p_children) is distinct from 'array' or jsonb_array_length(p_children) <> (
    select count(*) from public.registration_children where application_id=a.id
  ) then raise exception 'Keep all existing children in this application'; end if;
  if (select count(distinct x->>'childId') from jsonb_array_elements(p_children) x) <> jsonb_array_length(p_children) then
    raise exception 'Duplicate child ID';
  end if;
  update public.registration_applications set registration_type=coalesce(nullif(trim(p_parent->>'registrationType'),''),a.registration_type),
    parent_full_name=trim(p_parent->>'fullName'),
    parent_national_id=trim(p_parent->>'nationalId'), parent_phone=trim(p_parent->>'phone'),
    parent_whatsapp=nullif(trim(p_parent->>'whatsapp'),''), parent_email=lower(trim(p_parent->>'email')),
    parent_nationality=p_parent->>'nationality', parent_occupation=p_parent->>'occupation',
    parent_workplace=p_parent->>'workplace', parent_address=p_parent->>'address', parent_notes=p_parent->>'notes'
    where id=a.id;
  for c in select value from jsonb_array_elements(p_children) loop
    update public.registration_children set full_name=trim(c->>'fullName'), national_id=trim(c->>'nationalId'),
      birth_date=(c->>'birthDate')::date, blood_type=c->>'bloodType', parent_notes=c->>'notes'
      where id=(c->>'childId')::uuid and application_id=a.id;
    if not found then raise exception 'Child does not belong to this application'; end if;
  end loop;
end $$;
create or replace function public.update_registration_draft(p_application_id uuid, p_parent jsonb, p_children jsonb)
returns void language sql security invoker set search_path = '' as $$
  select internal.update_registration_draft(p_application_id,p_parent,p_children)
$$;
revoke all on function internal.update_registration_draft(uuid,jsonb,jsonb), public.update_registration_draft(uuid,jsonb,jsonb) from public, anon, service_role;
grant execute on function internal.update_registration_draft(uuid,jsonb,jsonb), public.update_registration_draft(uuid,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
