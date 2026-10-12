-- Coach specialties retain the existing coach role and its non-financial policy.
-- Player ownership remains unchanged. Goalkeepers stay in their age-group team.
begin;
alter table public.staff add column coach_kind text not null default 'team'
  check (coach_kind in ('team','assistant','goalkeeper'));
alter table public.staff add column supervising_coach_id text references public.staff(id) on delete set null;
alter table public.teams add column goalkeeper_coach_id text references public.staff(id) on delete set null;
create index teams_goalkeeper_coach_idx on public.teams(goalkeeper_coach_id) where goalkeeper_coach_id is not null;
grant select(goalkeeper_coach_id) on public.teams to authenticated;
create index staff_supervising_coach_idx on public.staff(supervising_coach_id) where supervising_coach_id is not null;
grant select(coach_kind,supervising_coach_id) on public.staff to authenticated;
alter table public.staff_applications drop constraint staff_applications_requested_role_check;
alter table public.staff_applications add constraint staff_applications_requested_role_check
 check(requested_role in ('manager','coach','assistant_coach','goalkeeper_coach','accountant','receptionist'));

create or replace function internal.validate_coach_specialty() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role <> 'coach' and (new.coach_kind <> 'team' or new.supervising_coach_id is not null) then
  raise exception 'Only coaches can have a coaching specialty';
 end if;
 if new.coach_kind <> 'assistant' and new.supervising_coach_id is not null then
  raise exception 'Only assistants can be linked to a supervising coach';
 end if;
 if new.supervising_coach_id is not null then
  if new.supervising_coach_id=new.id or not exists(select 1 from public.staff s
    where s.id=new.supervising_coach_id and s.role='coach' and s.status='active' and s.coach_kind in ('team','goalkeeper')) then
   raise exception 'Choose an active team or goalkeeper coach';
  end if;
 end if;
 if new.coach_kind <> 'team' and exists(select 1 from public.teams where coach_id=new.id) then
  raise exception 'Reassign existing teams before changing this coach specialty';
 end if;
 if (new.role <> 'coach' or new.coach_kind <> 'goalkeeper') and exists(select 1 from public.teams where goalkeeper_coach_id=new.id) then
  raise exception 'Reassign goalkeeper teams before changing this coach specialty';
 end if;
 if new.coach_kind='assistant' and exists(select 1 from public.staff where supervising_coach_id=new.id) then
  raise exception 'Reassign assistants before changing their supervisor to assistant';
 end if;
 return new;
end $$;
revoke all on function internal.validate_coach_specialty() from public,anon,authenticated;
create trigger validate_coach_specialty before insert or update of role,coach_kind,supervising_coach_id on public.staff
 for each row execute function internal.validate_coach_specialty();

create or replace function internal.validate_goalkeeper_coach() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.goalkeeper_coach_id is not null and not exists(select 1 from public.staff s where s.id=new.goalkeeper_coach_id and s.role='coach' and s.status='active' and s.coach_kind='goalkeeper') then
  raise exception 'Select an active goalkeeper coach';
 end if;
 return new;
end $$;
revoke all on function internal.validate_goalkeeper_coach() from public,anon,authenticated;
create trigger validate_goalkeeper_coach before insert or update of goalkeeper_coach_id on public.teams for each row execute function internal.validate_goalkeeper_coach();

create or replace function internal.coach_has_team(p_staff_id text,p_team_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.teams t on t.coach_id=supervisor.id
 where actor.id=p_staff_id and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active' and supervisor.coach_kind='team'
 and t.id=p_team_id);
$$;
create or replace function internal.coach_has_player(p_staff_id text,p_player_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.players p on p.id=p_player_id
 where actor.id=p_staff_id and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active'
 and ((supervisor.coach_kind='goalkeeper' and exists(select 1 from public.teams gt where gt.id=p.team_id and gt.goalkeeper_coach_id=supervisor.id) and lower(trim(p.position)) in ('حارس مرمى','حارس','goalkeeper','gk'))
 or (supervisor.coach_kind='team' and exists(select 1 from public.teams t where t.id=p.team_id and t.coach_id=supervisor.id))));
$$;
create or replace function internal.is_coach_of_team(p_team_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and internal.coach_has_team(internal.current_staff_id(),p_team_id);
$$;
create or replace function internal.is_coach_of_player(p_player_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and internal.coach_has_player(internal.current_staff_id(),p_player_id);
$$;
revoke all on function internal.coach_has_team(text,text),internal.coach_has_player(text,text),internal.is_coach_of_player(text) from public,anon,authenticated;
grant execute on function internal.is_coach_of_player(text) to authenticated;
-- Existing is_coach_of_team privileges are preserved by CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION internal.approve_staff_application_as_staff(p_application_id uuid, p_reviewer_staff_id text)
 RETURNS staff_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.staff_applications; v_staff_id text;
begin
 if not exists(select 1 from public.staff where id=p_reviewer_staff_id and role='manager' and status='active') then
  raise exception 'Active manager reviewer required' using errcode='42501';
 end if;
 select * into v_row from public.staff_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if v_row.status<>'pending' then raise exception 'Only pending applications can be approved'; end if;
 if exists(select 1 from public.staff where user_id=v_row.applicant_user_id) then raise exception 'Staff account already exists'; end if;
 if exists(select 1 from public.staff where lower(email)=lower(v_row.email)) then raise exception 'Staff email already exists'; end if;
 v_staff_id:='staff-'||gen_random_uuid()::text;
 insert into public.staff(id,user_id,name,email,phone,role,salary,specialization,status,joined_date,avatar_url,national_id,licenses,experience_years,rating,tactical_style,notes)
 values(v_staff_id,v_row.applicant_user_id,v_row.full_name,v_row.email,v_row.phone,case when v_row.requested_role in ('assistant_coach','goalkeeper_coach') then 'coach' else v_row.requested_role end,0,
  coalesce(v_row.specialization,''),'active',current_date,'',v_row.national_id,v_row.licenses,v_row.experience_years,null,null,v_row.applicant_notes);
 update public.staff set coach_kind=case v_row.requested_role when 'assistant_coach' then 'assistant' when 'goalkeeper_coach' then 'goalkeeper' else 'team' end where id=v_staff_id;
 update public.staff_applications set status='approved',reviewed_at=now(),reviewed_by_staff_id=p_reviewer_staff_id,
  approved_staff_id=v_staff_id,updated_at=now() where id=v_row.id returning * into v_row;
 return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION internal.create_or_update_staff_application(p_requested_role text, p_full_name text, p_phone text, p_national_id text DEFAULT NULL::text, p_specialization text DEFAULT NULL::text, p_experience_years integer DEFAULT NULL::integer, p_licenses text[] DEFAULT '{}'::text[], p_applicant_notes text DEFAULT NULL::text)
 RETURNS staff_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid()); v_email text; v_row public.staff_applications;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_requested_role not in ('manager','coach','assistant_coach','goalkeeper_coach','accountant','receptionist') then raise exception 'Invalid requested role'; end if;
 select lower(trim(email)) into v_email from auth.users where id=v_uid;
 if v_email is null then raise exception 'Authenticated email required'; end if;
 if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'Full name required'; end if;
 if nullif(trim(coalesce(p_phone,'')),'') is null then raise exception 'Phone required'; end if;
 if p_experience_years is not null and p_experience_years<0 then raise exception 'Invalid experience years'; end if;
 if exists(select 1 from public.staff where user_id=v_uid) then raise exception 'Staff account already exists'; end if;
 select * into v_row from public.staff_applications
 where applicant_user_id=v_uid and status in ('draft','needs_info')
 order by created_at desc limit 1 for update;
 if found then
  update public.staff_applications set requested_role=p_requested_role,full_name=trim(p_full_name),email=v_email,phone=trim(p_phone),
   national_id=nullif(trim(coalesce(p_national_id,'')),''),
   specialization=nullif(trim(coalesce(p_specialization,'')),''),
   experience_years=p_experience_years,licenses=coalesce(p_licenses,'{}'),
   applicant_notes=nullif(trim(coalesce(p_applicant_notes,'')),''),
   status='draft',review_notes=null,reviewed_at=null,reviewed_by_staff_id=null,updated_at=now()
  where id=v_row.id returning * into v_row;
 else
  insert into public.staff_applications(applicant_user_id,requested_role,full_name,email,phone,national_id,specialization,experience_years,licenses,applicant_notes)
  values(v_uid,p_requested_role,trim(p_full_name),v_email,trim(p_phone),nullif(trim(coalesce(p_national_id,'')),''),
   nullif(trim(coalesce(p_specialization,'')),''),p_experience_years,coalesce(p_licenses,'{}'),nullif(trim(coalesce(p_applicant_notes,'')),''))
  returning * into v_row;
 end if;
 return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION internal.is_coach_of_parent(p_parent_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if p_parent_id is null or nullif(trim(p_parent_id),'') is null then return false; end if; return exists (select 1 from public.players p where p.parent_id=p_parent_id and internal.is_coach_of_player(p.id)); end; $function$
;

CREATE OR REPLACE FUNCTION internal.publish_player_evaluation_impl(p_evaluation_id uuid)
 RETURNS player_evaluations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_staff_id text := internal.current_staff_id();
  v_is_manager boolean := internal.has_role(array['manager'::text]);
  v_is_coach boolean := internal.has_role(array['coach'::text]);
  v_eval public.player_evaluations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (v_is_manager or v_is_coach) or v_staff_id is null then raise exception 'Not authorized'; end if;

  select * into v_eval from public.player_evaluations where id = p_evaluation_id for update;
  if v_eval.id is null then raise exception 'Evaluation not found'; end if;
  if v_eval.status <> 'draft' then raise exception 'Evaluation is already published'; end if;
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_player(v_eval.player_id)) then
    raise exception 'Coach may publish own assigned-team evaluations only';
  end if;
  if v_eval.technical_score is null or v_eval.tactical_score is null or v_eval.physical_score is null or v_eval.mental_score is null or v_eval.discipline_score is null then
    raise exception 'All evaluation scores are required before publishing';
  end if;

  update public.player_evaluations
  set status='published', published_at=now(), updated_at=now(), row_version=row_version+1
  where id=p_evaluation_id returning * into v_eval;
  return v_eval;
end;
$function$
;

-- Preserve the installed attendance identity implementation (legacy or match-aware).
DO $scope$
DECLARE definition text; fn record;
BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='internal' AND p.proname='record_attendance_entry_impl'
 LOOP
  definition := pg_get_functiondef(fn.oid);
  IF position('internal.is_coach_of_team(v_player.team_id)' in definition)=0 THEN
   RAISE EXCEPTION 'Attendance scope definition changed; review before applying';
  END IF;
  EXECUTE replace(definition,'internal.is_coach_of_team(v_player.team_id)','internal.is_coach_of_player(v_player.id)');
 END LOOP;
END $scope$;

CREATE OR REPLACE FUNCTION internal.save_player_evaluation_impl(p_evaluation_id uuid, p_player_id text, p_evaluation_date date, p_period_type text, p_technical_score smallint, p_tactical_score smallint, p_physical_score smallint, p_mental_score smallint, p_discipline_score smallint, p_strengths text, p_development_areas text, p_coach_notes text, p_coach_recommendation text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_staff_id text := internal.current_staff_id();
  v_is_manager boolean := internal.has_role(array['manager'::text]);
  v_is_coach boolean := internal.has_role(array['coach'::text]);
  v_player public.players%rowtype;
  v_eval public.player_evaluations%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (v_is_manager or v_is_coach) or v_staff_id is null then raise exception 'Not authorized'; end if;
  if p_period_type not in ('monthly','quarterly','custom') then raise exception 'Invalid evaluation period'; end if;
  if p_evaluation_date is null then raise exception 'Evaluation date is required'; end if;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'Player not found'; end if;
  if v_is_coach and not internal.is_coach_of_player(v_player.id) then
    raise exception 'Coach may evaluate assigned team players only';
  end if;

  if p_evaluation_id is null then
    insert into public.player_evaluations(
      player_id, team_id, coach_id, evaluation_date, period_type,
      technical_score, tactical_score, physical_score, mental_score, discipline_score,
      strengths, development_areas, coach_notes, coach_recommendation
    ) values (
      v_player.id, nullif(v_player.team_id,''), v_staff_id, p_evaluation_date, p_period_type,
      p_technical_score, p_tactical_score, p_physical_score, p_mental_score, p_discipline_score,
      nullif(trim(p_strengths),''), nullif(trim(p_development_areas),''), nullif(trim(p_coach_notes),''), nullif(trim(p_coach_recommendation),'')
    ) returning id into v_id;
    return v_id;
  end if;

  select * into v_eval from public.player_evaluations where id = p_evaluation_id for update;
  if v_eval.id is null then raise exception 'Evaluation not found'; end if;
  if v_eval.status <> 'draft' then raise exception 'Published evaluation cannot be edited'; end if;
  if v_eval.player_id <> p_player_id then raise exception 'Player cannot be changed'; end if;
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_player(v_eval.player_id)) then
    raise exception 'Coach may edit own assigned-team draft evaluations only';
  end if;

  update public.player_evaluations
  set evaluation_date = p_evaluation_date,
      period_type = p_period_type,
      technical_score = p_technical_score,
      tactical_score = p_tactical_score,
      physical_score = p_physical_score,
      mental_score = p_mental_score,
      discipline_score = p_discipline_score,
      strengths = nullif(trim(p_strengths),''),
      development_areas = nullif(trim(p_development_areas),''),
      coach_notes = nullif(trim(p_coach_notes),''),
      coach_recommendation = nullif(trim(p_coach_recommendation),''),
      updated_at = now(), row_version = row_version + 1
  where id = p_evaluation_id;
  return p_evaluation_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION internal.save_player_evaluation_v2_impl(p_evaluation_id uuid, p_player_id text, p_evaluation_date date, p_period_type text, p_technical_score smallint, p_tactical_score smallint, p_physical_score smallint, p_mental_score smallint, p_discipline_score smallint, p_strengths text, p_development_areas text, p_coach_notes text, p_coach_recommendation text, p_detailed_scores jsonb, p_development_priorities text[], p_training_action text, p_reassessment_date date, p_final_recommendation text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_staff_id text := internal.current_staff_id();
  v_is_manager boolean := internal.has_role(array['manager'::text]);
  v_is_coach boolean := internal.has_role(array['coach'::text]);
  v_player public.players%rowtype;
  v_eval public.player_evaluations%rowtype;
  v_id uuid;
  v_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (v_is_manager or v_is_coach) or v_staff_id is null then raise exception 'Not authorized'; end if;
  if p_period_type not in ('monthly','quarterly','custom') then raise exception 'Invalid evaluation period'; end if;
  if p_evaluation_date is null then raise exception 'Evaluation date is required'; end if;
  if p_detailed_scores is null or jsonb_typeof(p_detailed_scores) <> 'object' then raise exception 'Detailed scores must be an object'; end if;
  if cardinality(coalesce(p_development_priorities,'{}'::text[])) > 2 then raise exception 'At most two development priorities are allowed'; end if;
  if p_reassessment_date is not null and p_reassessment_date < p_evaluation_date then raise exception 'Reassessment date cannot precede evaluation date'; end if;

  for v_value in select value from jsonb_each(p_detailed_scores)
  loop
    if v_value <> 'null'::jsonb and (jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}')::numeric < 1 or (v_value #>> '{}')::numeric > 5) then
      raise exception 'Detailed scores must be null or between 1 and 5';
    end if;
  end loop;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'Player not found'; end if;
  if v_is_coach and not internal.is_coach_of_player(v_player.id) then raise exception 'Coach may evaluate assigned team players only'; end if;

  if p_evaluation_id is null then
    insert into public.player_evaluations(
      player_id, team_id, coach_id, evaluation_date, period_type,
      technical_score, tactical_score, physical_score, mental_score, discipline_score,
      strengths, development_areas, coach_notes, coach_recommendation,
      detailed_scores, development_priorities, training_action, reassessment_date, final_recommendation
    ) values (
      v_player.id, nullif(v_player.team_id,''), v_staff_id, p_evaluation_date, p_period_type,
      p_technical_score, p_tactical_score, p_physical_score, p_mental_score, p_discipline_score,
      nullif(trim(p_strengths),''), nullif(trim(p_development_areas),''), nullif(trim(p_coach_notes),''), nullif(trim(p_coach_recommendation),''),
      p_detailed_scores, coalesce(p_development_priorities,'{}'::text[]), nullif(trim(p_training_action),''),
      p_reassessment_date, nullif(trim(p_final_recommendation),'')
    ) returning id into v_id;
    return v_id;
  end if;

  select * into v_eval from public.player_evaluations where id = p_evaluation_id for update;
  if v_eval.id is null then raise exception 'Evaluation not found'; end if;
  if v_eval.status <> 'draft' then raise exception 'Published evaluation cannot be edited'; end if;
  if v_eval.player_id <> p_player_id then raise exception 'Player cannot be changed'; end if;
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_player(v_eval.player_id)) then
    raise exception 'Coach may edit own assigned-team draft evaluations only';
  end if;

  update public.player_evaluations
  set evaluation_date=p_evaluation_date, period_type=p_period_type,
      technical_score=p_technical_score, tactical_score=p_tactical_score,
      physical_score=p_physical_score, mental_score=p_mental_score,
      discipline_score=p_discipline_score, strengths=nullif(trim(p_strengths),''),
      development_areas=nullif(trim(p_development_areas),''), coach_notes=nullif(trim(p_coach_notes),''),
      coach_recommendation=nullif(trim(p_coach_recommendation),''),
      detailed_scores=p_detailed_scores,
      development_priorities=coalesce(p_development_priorities,'{}'::text[]),
      training_action=nullif(trim(p_training_action),''),
      reassessment_date=p_reassessment_date,
      final_recommendation=nullif(trim(p_final_recommendation),''),
      updated_at=now(), row_version=row_version+1
  where id=p_evaluation_id;
  return p_evaluation_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION internal.validate_team_coach()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.coach_id IS NULL OR NEW.coach_id = '' THEN RAISE EXCEPTION 'A team must have an assigned coach'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = NEW.coach_id AND s.role='coach' AND s.status='active' AND s.coach_kind='team') THEN
    RAISE EXCEPTION 'Assigned team coach must be an active staff member with role coach';
  END IF;
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION internal.finalize_registered_player(p_player_id text, p_team_id text DEFAULT NULL::text, p_position text DEFAULT NULL::text, p_jersey_number integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_player public.players%rowtype; v_team public.teams%rowtype; v_actor public.staff%rowtype; v_auto_team text;
begin
 select s.* into v_actor from public.staff s where s.user_id=(select auth.uid()) and s.status='active' limit 1;
 if not found or v_actor.role not in ('manager','coach') then raise exception 'Manager or coach authorization required' using errcode='42501'; end if;
 select * into v_player from public.players where id=p_player_id for update;
 if not found then raise exception 'Player not found'; end if;
 if not exists(select 1 from public.registration_children c join public.registration_applications a on a.id=c.application_id where c.approved_player_id=p_player_id and a.status='approved') then raise exception 'Approved registration required'; end if;
 v_auto_team:=internal.registration_team_for_birth_date(v_player.birth_date);
 if v_auto_team is null then raise exception 'No team matches the player birth category'; end if;
 select * into v_team from public.teams where id=v_auto_team;
 if v_actor.role='coach' and not internal.is_coach_of_player(v_player.id) then raise exception 'Coach may only update their team' using errcode='42501'; end if;
 if p_jersey_number is not null and p_jersey_number>0 and exists(select 1 from public.players where team_id=v_auto_team and jersey_number=p_jersey_number and id<>p_player_id) then raise exception 'Jersey number is already used in the selected team'; end if;
 update public.players set team_id=v_auto_team,
 position=coalesce(nullif(trim(coalesce(p_position,'')),''),position),
 jersey_number=case when coalesce(p_jersey_number,0)>0 then p_jersey_number else jersey_number end,
 status='active' where id=p_player_id returning * into v_player;
 if v_team.coach_id is not null then
  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  select 'notif-'||gen_random_uuid()::text,'لاعب جديد في فريقك','تم إسناد '||v_player.name||' إلى '||v_team.name||'. يمكنك استكمال المركز ورقم القميص.',now()::text,'registration',false,s.user_id
  from public.staff s where s.id=v_team.coach_id and s.user_id is not null and s.status='active';
 end if;
 return jsonb_build_object('success',true,'playerId',v_player.id,'teamId',v_player.team_id,'position',v_player.position,'jerseyNumber',v_player.jersey_number,'status',v_player.status,'coachId',v_team.coach_id);
end $function$
;

CREATE OR REPLACE FUNCTION internal.update_team_player_technical_assignment(p_player_id text, p_position text DEFAULT NULL::text, p_jersey_number integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor public.staff%rowtype; v_player public.players%rowtype; v_team public.teams%rowtype;
begin
 select * into v_actor from public.staff where user_id=(select auth.uid()) and status='active' limit 1;
 if not found or v_actor.role not in ('manager','coach') then raise exception 'Manager or coach authorization required' using errcode='42501'; end if;
 select * into v_player from public.players where id=p_player_id for update;
 if not found then raise exception 'Player not found'; end if;
 if v_player.team_id is null then raise exception 'Player must be assigned to a team first'; end if;
 select * into v_team from public.teams where id=v_player.team_id;
 if v_actor.role='coach' and not internal.is_coach_of_player(v_player.id) then raise exception 'Coach may only update players in their own team' using errcode='42501'; end if;
 if p_jersey_number is not null and p_jersey_number>0 and exists(select 1 from public.players where team_id=v_player.team_id and jersey_number=p_jersey_number and id<>p_player_id) then raise exception 'Jersey number is already used in the team'; end if;
 update public.players set
  position=coalesce(nullif(trim(coalesce(p_position,'')),''),position),
  jersey_number=case when coalesce(p_jersey_number,0)>0 then p_jersey_number else jersey_number end
 where id=p_player_id returning * into v_player;
 return jsonb_build_object('success',true,'playerId',v_player.id,'teamId',v_player.team_id,'position',v_player.position,'jerseyNumber',v_player.jersey_number);
end $function$
;

alter policy "delete_player_documents_authorized" on public."player_documents" using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_player(p.id)))))));

alter policy "insert_attendance_authorized" on public."attendance" with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_player(p.id)))))));

alter policy "insert_player_documents_authorized" on public."player_documents" with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_player(p.id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = player_documents.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));

alter policy "player_evaluations_select_authorized" on public."player_evaluations" using ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_player(player_id)) OR (internal.has_role(ARRAY['parent'::text]) AND (status = 'published'::text) AND internal.is_parent_of_player(player_id))));

alter policy "select_attendance_authenticated" on public."attendance" using ((internal.has_role(ARRAY['manager'::text, 'accountant'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_player(p.id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = attendance.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));

alter policy "select_players_authenticated" on public."players" using ((internal.has_role(ARRAY['manager'::text, 'accountant'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_player(id)) OR (internal.has_role(ARRAY['parent'::text]) AND internal.is_parent_of_player(id))));

alter policy "update_attendance_authorized" on public."attendance" using ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_player(p.id))))))) with check ((internal.has_role(ARRAY['manager'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = attendance.player_id) AND internal.is_coach_of_player(p.id)))))));

alter policy "update_player_documents_authorized" on public."player_documents" using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_player(p.id))))))) with check ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_player(p.id)))))));

alter policy "delete_player_documents_bucket_authorized" on storage."objects" using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_player(p.id))))))));

alter policy "insert_player_documents_bucket_authorized" on storage."objects" with check (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_player(p.id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND (pa.user_id = ( SELECT auth.uid() AS uid)))))))));

alter policy "update_player_documents_bucket_authorized" on storage."objects" using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_player(p.id)))))))) with check (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_player(p.id))))))));

alter policy "select_player_documents_bucket_staff_roles" on storage."objects" using (((bucket_id = 'player-documents'::text) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND internal.is_coach_of_player(p.id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = (storage.foldername(objects.name))[1]) AND (pa.user_id = auth.uid()))))))));

alter policy "select_approved_registration_player_files" on storage."objects" using (((bucket_id = 'player-documents'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (EXISTS ( SELECT 1
   FROM (player_documents d
     JOIN players p ON ((p.id = d.player_id)))
  WHERE ((d.file_path = objects.name) AND (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND internal.is_coach_of_player(p.id)) OR (internal.has_role(ARRAY['parent'::text]) AND internal.is_parent_of_player(p.id))))))));

alter policy "select_player_documents_staff_roles" on public."player_documents" using ((internal.has_role(ARRAY['manager'::text, 'receptionist'::text]) OR (internal.has_role(ARRAY['coach'::text]) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = player_documents.player_id) AND internal.is_coach_of_player(p.id))))) OR (internal.has_role(ARRAY['parent'::text]) AND (EXISTS ( SELECT 1
   FROM (players p
     JOIN parents pa ON ((pa.id = p.parent_id)))
  WHERE ((p.id = player_documents.player_id) AND (pa.user_id = ( SELECT auth.uid() AS uid))))))));

-- A parent can add files only for their own linked child and matching private path.
create policy parent_document_path_integrity on public.player_documents as restrictive for insert to authenticated
 with check (not internal.has_role(array['parent']) or
 (internal.is_parent_of_player(player_id) and split_part(file_path,'/',1)=player_id and file_category in ('photo','document')));
-- Clean up an upload that could not be attached, without allowing document deletion.
create policy parent_unattached_upload_cleanup on storage.objects for delete to authenticated
 using (bucket_id='player-documents' and owner_id=(select auth.uid())::text
 and internal.has_role(array['parent']) and internal.is_parent_of_player((storage.foldername(name))[1])
 and not exists(select 1 from public.player_documents d where d.file_path=objects.name));
-- Goalkeeper coaches can read relevant team schedules, without team-wide writes.
create policy coach_player_training_schedule on public.trainings for select to authenticated
 using (internal.has_role(array['coach']) and exists(select 1 from public.players p where p.team_id=trainings.team_id and internal.is_coach_of_player(p.id)));
create policy coach_player_match_schedule on public.matches for select to authenticated
 using (internal.has_role(array['coach']) and exists(select 1 from public.players p where p.team_id=matches.team_id and internal.is_coach_of_player(p.id)));
notify pgrst, 'reload schema';
commit;
