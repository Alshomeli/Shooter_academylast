-- Schema-only fixture from the inspected production catalog, no user data.
create role anon; create role authenticated; create schema auth; create schema internal; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,email text);
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
create table public.attendance("id" text primary key,"player_id" text,"session_date" date,"session_type" text default 'training'::text,"status" text default 'present'::text,"notes" text,"created_at" timestamptz default now(),"training_id" text,"row_version" int8 default 0,"match_id" text);
create table public.matches("id" text primary key,"team_id" text default ''::text,"opponent" text default ''::text,"match_date" date,"location" text default ''::text,"result" text default 'scheduled'::text,"academy_score" int4 default 0,"opponent_score" int4 default 0,"scorers" text,"notes" text,"created_at" timestamptz default now(),"row_version" int8 default 0);
create table public.notifications("id" text primary key,"title" text default ''::text,"message" text default ''::text,"timestamp" text default ''::text,"type" text default 'info'::text,"read" bool default false,"created_at" timestamptz default now(),"recipient_user_id" uuid,"row_version" int8 default 0);
create table public.parents("id" text primary key,"name" text,"national_id" text default ''::text,"nationality" text default ''::text,"phone" text default ''::text,"whatsapp_phone" text default ''::text,"email" text default ''::text,"address" text default ''::text,"occupation" text default ''::text,"workplace" text default ''::text,"avatar_url" text default ''::text,"status" text default 'active'::text,"notes" text default ''::text,"joined_date" date,"created_at" timestamptz default now(),"user_id" uuid,"row_version" int8 default 0);
create table public.player_documents("id" uuid default gen_random_uuid() primary key,"player_id" text,"file_name" text,"file_path" text,"file_type" text,"file_category" text default 'document'::text,"file_size" int8 default 0,"uploaded_at" timestamptz default now());
create table public.player_evaluations("id" uuid default gen_random_uuid() primary key,"player_id" text,"team_id" text,"coach_id" text,"evaluation_date" date default CURRENT_DATE,"period_type" text default 'monthly'::text,"technical_score" int2,"tactical_score" int2,"physical_score" int2,"mental_score" int2,"discipline_score" int2,"strengths" text,"development_areas" text,"coach_notes" text,"coach_recommendation" text,"status" text default 'draft'::text,"published_at" timestamptz,"created_at" timestamptz default now(),"updated_at" timestamptz default now(),"row_version" int8 default 0,"overall_score" numeric,"detailed_scores" jsonb default '{}'::jsonb,"development_priorities" text[] default '{}'::text[],"training_action" text,"reassessment_date" date,"final_recommendation" text);
create table public.players("id" text primary key,"name" text,"birth_date" date,"blood_type" text default ''::text,"jersey_number" int4 default 0,"position" text default ''::text,"team_id" text default ''::text,"parent_name" text default ''::text,"parent_phone" text default ''::text,"parent_email" text default ''::text,"parent_id" text default ''::text,"status" text default 'active'::text,"notes" text default ''::text,"joined_date" date,"created_at" timestamptz default now(),"national_id" text,"row_version" int8 default 0);
create table public.registration_applications("id" uuid default gen_random_uuid() primary key,"applicant_user_id" uuid,"parent_full_name" text,"parent_national_id" text,"parent_phone" text,"parent_whatsapp" text,"parent_email" text,"parent_nationality" text,"parent_occupation" text,"parent_workplace" text,"parent_address" text,"parent_notes" text,"status" text default 'draft'::text,"review_notes" text,"reviewed_at" timestamptz,"reviewed_by_staff_id" text,"approved_parent_id" text,"submitted_at" timestamptz,"created_at" timestamptz default now(),"updated_at" timestamptz default now(),"registration_type" text default 'new_application'::text,"request_id" uuid);
create table public.registration_children("id" uuid default gen_random_uuid() primary key,"application_id" uuid,"full_name" text,"national_id" text,"birth_date" date,"blood_type" text,"parent_notes" text,"approved_player_id" text,"created_at" timestamptz default now(),"client_key" text);
create table public.staff("id" text primary key,"name" text,"email" text,"phone" text default ''::text,"role" text default 'receptionist'::text,"salary" numeric default 0,"specialization" text default ''::text,"status" text default 'active'::text,"joined_date" date,"avatar_url" text default ''::text,"national_id" text,"licenses" text[] default '{}'::text[],"experience_years" int4,"rating" numeric,"tactical_style" text,"notes" text,"created_at" timestamptz default now(),"user_id" uuid,"row_version" int8 default 0);
create table public.staff_applications("id" uuid default gen_random_uuid() primary key,"applicant_user_id" uuid,"requested_role" text,"full_name" text,"email" text,"phone" text,"national_id" text,"specialization" text,"experience_years" int4,"licenses" text[] default '{}'::text[],"applicant_notes" text,"status" text default 'draft'::text,"review_notes" text,"submitted_at" timestamptz,"reviewed_at" timestamptz,"reviewed_by_staff_id" text,"approved_staff_id" text,"created_at" timestamptz default now(),"updated_at" timestamptz default now());
create table public.teams("id" text primary key,"name" text,"age_group" text default ''::text,"coach_id" text default ''::text,"training_days" text[] default '{}'::text[],"training_time" text default ''::text,"pitch_number" text default ''::text,"created_at" timestamptz default now(),"row_version" int8 default 0);
create table public.trainings("id" text primary key,"team_id" text default ''::text,"title" text default ''::text,"session_date" date,"duration_minutes" int4 default 90,"objectives" text default ''::text,"created_at" timestamptz default now(),"row_version" int8 default 0,"status" text default 'scheduled'::text,"completed_at" timestamptz,"completed_by" text);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text,name text,owner_id text);
CREATE OR REPLACE FUNCTION internal.current_staff_id()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id text;
begin
  select s.id into v_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.status = 'active'
  limit 1;
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION internal.has_role(allowed_roles text[])
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.role = any(allowed_roles)
  ) or exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and 'parent' = any(allowed_roles)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION internal.is_active_member()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
  ) or exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION internal.is_coach_of_parent(p_parent_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if p_parent_id is null or nullif(trim(p_parent_id),'') is null then return false; end if; return exists (select 1 from public.players p where p.parent_id=p_parent_id and internal.is_coach_of_team(p.team_id)); end; $function$
;
CREATE OR REPLACE FUNCTION internal.is_coach_of_team(p_team_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_team_id is null or nullif(trim(p_team_id),'') is null then return false; end if;
  return exists (
    select 1
    from public.teams t
    join public.staff s on s.id = t.coach_id
    where t.id = p_team_id
      and s.role = 'coach'
      and s.status = 'active'
      and s.user_id = (select auth.uid())
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION internal.is_parent_of_player(p_player_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if p_player_id is null or nullif(trim(p_player_id),'') is null then return false; end if; return exists (select 1 from public.players p join public.parents pa on pa.id=p.parent_id where p.id=p_player_id and pa.user_id=(select auth.uid())); end; $function$
;
create function internal.is_academy_admin() returns boolean language sql stable as $$ select internal.has_role(array['manager']) $$;
create function internal.can_cleanup_registration_file(text) returns boolean language sql as $$ select false $$;
create function internal.current_user_role() returns text language sql as $$ select role from public.staff where user_id=auth.uid() and status='active' $$;
create function internal.registration_team_for_birth_date(date) returns text language sql as $$ select 't1'::text $$;
alter table staff_applications add constraint staff_applications_requested_role_check check(requested_role in ('manager','coach','accountant','receptionist'));
create policy "delete_attendance_authorized" on public."attendance" for DELETE to authenticated using (internal.has_role(ARRAY['manager'::text]));
create policy "delete_player_documents_authorized" on public."player_documents" for DELETE to authenticated using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_team(p.team_id)))))));
create policy "delete_players_authorized" on public."players" for DELETE to authenticated using (internal.has_role(ARRAY['manager'::text]));
create policy "delete_staff_manager" on public."staff" for DELETE to authenticated using (internal.has_role(ARRAY['manager'::text]));
create policy "delete_teams_authorized" on public."teams" for DELETE to authenticated using (internal.has_role(ARRAY['manager'::text]));
create policy "insert_attendance_authorized" on public."attendance" for INSERT to authenticated with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_team(p.team_id)))))));
create policy "insert_player_documents_authorized" on public."player_documents" for INSERT to authenticated with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_team(p.team_id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = player_documents.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "insert_players_authorized" on public."players" for INSERT to authenticated with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_team(team_id))));
create policy "insert_staff_manager_only" on public."staff" for INSERT to authenticated with check (( SELECT internal.has_role(ARRAY['manager'::text]) AS has_role));
create policy "insert_teams_authorized" on public."teams" for INSERT to authenticated with check (internal.has_role(ARRAY['manager'::text]));
create policy "player_evaluations_select_authorized" on public."player_evaluations" for SELECT to authenticated using ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_team(team_id)) OR (internal.has_role(ARRAY['parent'::text]) AND (status = 'published'::text) AND internal.is_parent_of_player(player_id))));
create policy "select_staff_role_scoped" on public."staff" for SELECT to authenticated using (((id = ( SELECT internal.current_staff_id() AS current_staff_id)) OR ( SELECT internal.has_role(ARRAY['manager'::text, 'receptionist'::text, 'accountant'::text]) AS has_role)));
create policy "select_teams_authenticated" on public."teams" for SELECT to authenticated using (internal.is_active_member());
create policy "select_attendance_authenticated" on public."attendance" for SELECT to authenticated using ((internal.has_role(ARRAY['manager'::text, 'accountant'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_team(p.team_id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = attendance.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "select_players_authenticated" on public."players" for SELECT to authenticated using ((internal.has_role(ARRAY['manager'::text, 'accountant'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_team(team_id)) OR (internal.has_role(ARRAY['parent'::text]) AND internal.is_parent_of_player(id))));
create policy "update_attendance_authorized" on public."attendance" for UPDATE to authenticated using ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_team(p.team_id))))))) with check ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_team(p.team_id)))))));
create policy "update_player_documents_authorized" on public."player_documents" for UPDATE to authenticated using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_team(p.team_id))))))) with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_team(p.team_id)))))));
create policy "update_staff_manager" on public."staff" for UPDATE to authenticated using (internal.has_role(ARRAY['manager'::text])) with check (internal.has_role(ARRAY['manager'::text]));
create policy "delete_player_documents_bucket_authorized" on storage."objects" for DELETE to authenticated using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_team(p.team_id))))))));
create policy "insert_player_documents_bucket_authorized" on storage."objects" for INSERT to authenticated with check (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_team(p.team_id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND (pa.user_id = ( SELECT auth.uid() AS uid)))))))));
create policy "registration_cleanup_delete" on storage."objects" for DELETE to authenticated using (((bucket_id = 'player-documents'::text) AND internal.can_cleanup_registration_file(name)));
create policy "registration_cleanup_requires_committed_delete" on storage."objects" as restrictive for DELETE to authenticated using (((bucket_id <> 'player-documents'::text) OR (name !~~ 'applications/%'::text) OR internal.can_cleanup_registration_file(name)));
create policy "registration_cleanup_select" on storage."objects" for SELECT to authenticated using (((bucket_id = 'player-documents'::text) AND internal.can_cleanup_registration_file(name)));
create policy "registration_storage_delete_applicant_or_manager" on storage."objects" for DELETE to authenticated using (((bucket_id = 'player-documents'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (EXISTS ( SELECT 1
   FROM registration_applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (( SELECT internal.is_academy_admin() AS is_academy_admin) OR ((a.applicant_user_id = ( SELECT auth.uid() AS uid)) AND (a.status = ANY (ARRAY['draft'::text, 'needs_info'::text])))))))));
create policy "registration_storage_insert_applicant" on storage."objects" for INSERT to authenticated with check (((bucket_id = 'player-documents'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (EXISTS ( SELECT 1
   FROM registration_applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_user_id = ( SELECT auth.uid() AS uid)) AND (a.status = ANY (ARRAY['draft'::text, 'needs_info'::text])) AND (((storage.foldername(objects.name))[3] = 'parent'::text) OR (EXISTS ( SELECT 1
           FROM registration_children c
          WHERE ((c.application_id = a.id) AND ((c.id)::text = (storage.foldername(objects.name))[3]))))))))));
create policy "registration_storage_select_authorized" on storage."objects" for SELECT to authenticated using (((bucket_id = 'player-documents'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (EXISTS ( SELECT 1
   FROM registration_applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (( SELECT internal.is_academy_admin() AS is_academy_admin) OR (a.applicant_user_id = ( SELECT auth.uid() AS uid))))))));
create policy "update_player_documents_bucket_authorized" on storage."objects" for UPDATE to authenticated using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_team(p.team_id)))))))) with check (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_team(p.team_id))))))));
create policy "update_players_authorized" on public."players" for UPDATE to authenticated using (internal.has_role(ARRAY['manager'::text, 'receptionist'::text])) with check (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]));
create policy "update_teams_authorized" on public."teams" for UPDATE to authenticated using (internal.has_role(ARRAY['manager'::text])) with check (internal.has_role(ARRAY['manager'::text]));
create policy "select_player_documents_bucket_staff_roles" on storage."objects" for SELECT to authenticated using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_team(p.team_id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND (pa.user_id = auth.uid()))))))));
create policy "select_approved_registration_player_files" on storage."objects" for SELECT to authenticated using (((bucket_id = 'player-documents'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (EXISTS ( SELECT 1
   FROM (player_documents d
     JOIN players p ON ((p.id = d.player_id)))
  WHERE ((d.file_path = objects.name) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_team(p.team_id)) OR (internal.has_role(ARRAY['parent'::text]) AND internal.is_parent_of_player(p.id))))))));
create policy "select_player_documents_staff_roles" on public."player_documents" for SELECT to authenticated using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_team(p.team_id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = player_documents.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));
alter table staff enable row level security;
alter table players enable row level security;
alter table teams enable row level security;
alter table player_documents enable row level security;
alter table attendance enable row level security;
alter table player_evaluations enable row level security;
alter table storage.objects enable row level security;
grant usage on schema public,internal,auth,storage to authenticated,anon;
grant select,insert,update,delete on all tables in schema public,storage to authenticated;

CREATE OR REPLACE FUNCTION internal.record_attendance_entry_impl(p_player_id text, p_session_date date, p_session_type text DEFAULT 'training'::text, p_status text DEFAULT 'present'::text, p_notes text DEFAULT NULL::text, p_training_id text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_player public.players%rowtype;
  v_attendance public.attendance%rowtype;
  v_training_id text := nullif(trim(coalesce(p_training_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_role := internal.current_user_role();
  if v_role is null or v_role not in ('manager', 'coach') then
    raise exception 'Only manager or coach can record attendance' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_player_id, '')), '') is null then
    raise exception 'Player is required';
  end if;
  if p_session_date is null then
    raise exception 'Session date is required';
  end if;
  if p_session_type not in ('training', 'match') then
    raise exception 'Invalid session type';
  end if;
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'Invalid attendance status';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id;

  if not found then
    raise exception 'Player not found';
  end if;

  if v_role = 'coach' and not internal.is_coach_of_team(v_player.team_id) then
    raise exception 'Coach can only record attendance for own team' using errcode = '42501';
  end if;

  insert into public.attendance (
    id, player_id, session_date, session_type, status, notes, training_id
  )
  values (
    'att-' || gen_random_uuid()::text,
    p_player_id,
    p_session_date,
    p_session_type,
    p_status,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_training_id
  )
  on conflict (player_id, session_date, session_type, (coalesce(training_id, '')), (coalesce(match_id, '')))
  do update set
    status = excluded.status,
    notes = excluded.notes
  returning * into v_attendance;

  return v_attendance;
end;
$function$
;
