-- Additional goalkeeper training categories preserve each player's registered age category.
alter table public.teams add column category_kind text not null default 'team'
 check(category_kind in ('team','goalkeeper'));
alter table public.teams add column status text not null default 'active'
 check(status in ('active','inactive'));
alter table public.player_evaluations
 add column evaluation_type text not null default 'outfield' check(evaluation_type in ('outfield','goalkeeper')),
 add column template_version smallint not null default 1 check(template_version in (1,2)),
 add column team_name text,
 add column height_cm numeric(5,1) check(height_cm between 30 and 250),
 add column weight_kg numeric(5,1) check(weight_kg between 1 and 300),
 add column nutrition_plan text,
 add column evaluator_name text,
 add column general_rating text check(general_rating in ('excellent','very_good','good','needs_development')),
 add column evaluator_signature text,
 add column coach_signature text,
 add column total_score smallint check(total_score between 10 and 50);

create or replace function internal.is_goalkeeper(p_position text) returns boolean
language sql immutable set search_path='' as $$
 select lower(btrim(coalesce(p_position,'')))=any(array['حارس مرمى','حارس','goalkeeper','gk']);
$$;
revoke all on function internal.is_goalkeeper(text) from public,anon;
grant execute on function internal.is_goalkeeper(text) to authenticated;

create or replace function internal.guard_category_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if not coalesce(internal.has_role(array['manager']),false) then raise exception 'Manager authorization required' using errcode='42501'; end if;
  if old.status<>'inactive' then raise exception 'Deactivate the category before deleting it'; end if;
  if exists(select 1 from public.players where team_id=old.id)
   or exists(select 1 from public.trainings where team_id=old.id)
   or exists(select 1 from public.matches where team_id=old.id)
   or exists(select 1 from public.player_evaluations where team_id=old.id) then
   raise exception 'Category has linked players or history; keep it inactive instead of deleting it' using errcode='23503';
  end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.category_kind is distinct from old.category_kind then raise exception 'Category type cannot be changed; create a new category'; end if;
 if new.category_kind='goalkeeper' and nullif(new.coach_id,'') is not null then raise exception 'Assign a goalkeeper coach using the goalkeeper coach field'; end if;
 return new;
end $$;
revoke all on function internal.guard_category_lifecycle() from public,anon,authenticated;
create trigger guard_category_lifecycle before insert or update or delete on public.teams
 for each row execute function internal.guard_category_lifecycle();

create or replace function internal.delete_team_safely(p_team_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(internal.has_role(array['manager']),false) then raise exception 'Manager authorization required' using errcode='42501'; end if;
 perform 1 from public.teams where id=p_team_id for update;
 if not found then raise exception 'Team not found'; end if;
 -- The lifecycle trigger rejects active and referenced categories. Never detach players or erase history.
 delete from public.teams where id=p_team_id;
 return jsonb_build_object('success',true,'teamId',p_team_id,'unassignedPlayers',0);
end $$;

create or replace function internal.guard_player_category() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_team public.teams;
begin
 if tg_op='UPDATE' and new.team_id is not distinct from old.team_id then return new; end if;
 if nullif(new.team_id,'') is null then return new; end if;
 select * into v_team from public.teams where id=new.team_id for share;
 if not found then raise exception 'Category not found'; end if;
 if v_team.category_kind<>'team' then raise exception 'Keep the player in the registered age category; goalkeeper groups are additional training categories'; end if;
 if v_team.status<>'active' then raise exception 'Cannot assign a player to an inactive category'; end if;
 return new;
end $$;
revoke all on function internal.guard_player_category() from public,anon,authenticated;
create trigger guard_player_category before insert or update of team_id on public.players
 for each row execute function internal.guard_player_category();

create or replace function internal.coach_has_player(p_staff_id text,p_player_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.players p on p.id=p_player_id
 where actor.id=p_staff_id and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active'
 and p.archived_at is null
 and ((supervisor.coach_kind='goalkeeper' and internal.is_goalkeeper(p.position))
 or (supervisor.coach_kind='team' and exists(select 1 from public.teams t where t.id=p.team_id and t.coach_id=supervisor.id))));
$$;
create or replace function internal.coach_has_team(p_staff_id text,p_team_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.teams t on t.id=p_team_id
 where actor.id=p_staff_id and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active'
 and ((supervisor.coach_kind='team' and t.category_kind='team' and t.coach_id=supervisor.id)
 or (supervisor.coach_kind='goalkeeper' and t.category_kind='goalkeeper' and t.goalkeeper_coach_id=supervisor.id)));
$$;
create or replace function internal.get_my_coach_team_ids() returns text[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(t.id),array[]::text[])
 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.teams t on (internal.coach_has_team(actor.id,t.id)
 or (supervisor.coach_kind='goalkeeper' and t.category_kind='team' and exists(
 select 1 from public.players p where p.team_id=t.id and p.archived_at is null and internal.is_goalkeeper(p.position))))
 where auth.uid() is not null and actor.user_id=auth.uid()
 and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active';
$$;

create or replace function internal.registration_team_for_birth_date(p_birth_date date) returns text
language plpgsql stable security definer set search_path='' as $$
declare v_year text; v_team_id text; v_age integer;
begin
 if p_birth_date is null then return null; end if;
 v_year:=extract(year from p_birth_date)::int::text;
 select t.id into v_team_id from public.teams t where t.status='active' and t.category_kind='team'
 and t.name ~ ('(^|[^0-9])'||v_year||'([^0-9]|$)') order by t.created_at limit 1;
 if v_team_id is not null then return v_team_id; end if;
 v_age:=extract(year from age(current_date,p_birth_date))::int;
 select t.id into v_team_id from public.teams t where t.status='active' and t.category_kind='team'
 and replace(upper(t.age_group),'-','')='U'||(v_age+1)::text order by t.created_at limit 1;
 return v_team_id;
end $$;

create or replace function internal.player_in_training_category(p_player_id text,p_team_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.players p join public.teams t on t.id=p_team_id
 where p.id=p_player_id and p.archived_at is null
 and ((t.category_kind='team' and p.team_id=t.id) or (t.category_kind='goalkeeper' and internal.is_goalkeeper(p.position))));
$$;
revoke all on function internal.player_in_training_category(text,text) from public,anon;
grant execute on function internal.player_in_training_category(text,text) to authenticated;

create or replace function internal.validate_attendance_training_link() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_training public.trainings;
begin
 if new.training_id is null then return new; end if;
 select * into v_training from public.trainings where id=new.training_id;
 if not found then raise exception 'Training not found'; end if;
 if new.session_date is distinct from v_training.session_date then raise exception 'Attendance date must match training date'; end if;
 if not internal.player_in_training_category(new.player_id,v_training.team_id) then raise exception 'Player is not eligible for this training category'; end if;
 return new;
end $$;
create or replace function internal.validate_attendance_session_link() returns trigger
language plpgsql set search_path='' as $$
declare v_player_team text; v_session_team text; v_session_date date;
begin
 if new.player_id is null or btrim(new.player_id)='' then raise exception 'Attendance requires a player'; end if;
 select team_id into v_player_team from public.players where id=new.player_id;
 if not found then raise exception 'Attendance player not found'; end if;
 if new.session_type='training' then
  if new.match_id is not null then raise exception 'Training attendance cannot reference a match'; end if;
  if new.training_id is not null then
   select team_id,session_date into v_session_team,v_session_date from public.trainings where id=new.training_id;
   if not found then raise exception 'Training not found'; end if;
   if not internal.player_in_training_category(new.player_id,v_session_team) then raise exception 'Player is not eligible for this training category'; end if;
   if new.session_date is distinct from v_session_date then raise exception 'Attendance date must match training date'; end if;
  end if;
 elsif new.session_type='match' then
  if new.training_id is not null then raise exception 'Match attendance cannot reference a training'; end if;
  if new.match_id is not null then
   select team_id,match_date into v_session_team,v_session_date from public.matches where id=new.match_id;
   if not found then raise exception 'Match not found'; end if;
   if v_session_team is distinct from v_player_team then raise exception 'Player is not in the match team'; end if;
   if new.session_date is distinct from v_session_date then raise exception 'Attendance date must match match date'; end if;
  end if;
 else raise exception 'Invalid attendance session type'; end if;
 return new;
end $$;

create or replace function internal.guard_session_category() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_team public.teams;
begin
 if tg_op='UPDATE' and new.team_id is not distinct from old.team_id then return new; end if;
 if nullif(new.team_id,'') is null then return new; end if;
 select * into v_team from public.teams where id=new.team_id for share;
 if not found or v_team.status<>'active' then raise exception 'Select an active category'; end if;
 if tg_table_name='matches' and v_team.category_kind='goalkeeper' then raise exception 'Matches belong to registered age categories; use training for goalkeeper groups'; end if;
 return new;
end $$;
revoke all on function internal.guard_session_category() from public,anon,authenticated;
create trigger guard_training_category before insert or update of team_id on public.trainings for each row execute function internal.guard_session_category();
create trigger guard_match_category before insert or update of team_id on public.matches for each row execute function internal.guard_session_category();

-- The supplied PDF templates: fourteen player criteria and ten goalkeeper criteria.
create or replace function internal.evaluation_template_groups(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='goalkeeper' then
 '{"technical":["gk_reflexes","gk_shot_handling","gk_high_balls","gk_distribution"],"tactical":["gk_positioning","gk_rushing_out","gk_communication"],"physical":["gk_agility"],"mental":["gk_focus"],"discipline":["gk_instructions"]}'::jsonb
 else '{"technical":["ball_control","passing","dribbling","shooting"],"tactical":["decision_making","positioning","teamwork"],"physical":["fitness","speed_agility","endurance"],"mental":["focus","coachability","sportsmanship"],"discipline":["discipline"]}'::jsonb end;
$$;
revoke all on function internal.evaluation_template_groups(text) from public,anon;
grant execute on function internal.evaluation_template_groups(text) to authenticated;

create or replace function internal.guard_pdf_evaluation() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_groups jsonb; v_allowed text[]; v_key text; v_value jsonb; v_summary jsonb:='{}'; v_avg numeric; v_total integer; v_count integer;
begin
 if tg_op='UPDATE' and old.status='published' then raise exception 'Published evaluation cannot be edited'; end if;
 if tg_op='UPDATE' and old.template_version=2 and
 (new.player_id,new.team_id,new.team_name,new.evaluation_type,new.template_version) is distinct from
 (old.player_id,old.team_id,old.team_name,old.evaluation_type,old.template_version) then raise exception 'Evaluation player, category and template are fixed'; end if;
 if new.template_version<>2 then return new; end if;
 v_groups:=internal.evaluation_template_groups(new.evaluation_type);
 select array_agg(k) into v_allowed from jsonb_each(v_groups) g cross join lateral jsonb_array_elements_text(g.value) k;
 if new.detailed_scores is null or jsonb_typeof(new.detailed_scores)<>'object' then raise exception 'Detailed scores must be an object'; end if;
 for v_key,v_value in select key,value from jsonb_each(new.detailed_scores) loop
  if not (v_key=any(v_allowed)) then raise exception 'Criterion does not belong to this evaluation template'; end if;
  if v_value<>'null'::jsonb and (jsonb_typeof(v_value)<>'number' or v_value::text !~ '^[1-5]$') then raise exception 'Criterion score must be an integer from 1 to 5'; end if;
 end loop;
 for v_key in select jsonb_object_keys(v_groups) loop
  select avg((new.detailed_scores->>k)::numeric) into v_avg from jsonb_array_elements_text(v_groups->v_key) k;
  v_summary:=v_summary||jsonb_build_object(v_key,v_avg);
 end loop;
 new.technical_score:=round((v_summary->>'technical')::numeric)::smallint;
 new.tactical_score:=round((v_summary->>'tactical')::numeric)::smallint;
 new.physical_score:=round((v_summary->>'physical')::numeric)::smallint;
 new.mental_score:=round((v_summary->>'mental')::numeric)::smallint;
 new.discipline_score:=round((v_summary->>'discipline')::numeric)::smallint;
 select sum((new.detailed_scores->>k)::integer),count(new.detailed_scores->>k) into v_total,v_count from unnest(v_allowed) k;
 new.total_score:=case when new.evaluation_type='goalkeeper' and v_count=10 then v_total else null end;
 if new.status='published' then
  if exists(select 1 from jsonb_each(v_summary) where value='null'::jsonb) then raise exception 'Rate at least one criterion in each domain before publishing'; end if;
  if new.evaluation_type='goalkeeper' and v_count<>10 then raise exception 'All ten goalkeeper criteria are required before publishing'; end if;
 end if;
 return new;
end $$;
revoke all on function internal.guard_pdf_evaluation() from public,anon,authenticated;
create trigger guard_pdf_evaluation before insert or update on public.player_evaluations for each row execute function internal.guard_pdf_evaluation();

create or replace function internal.save_player_evaluation_v3(p_form jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_staff text:=internal.current_staff_id(); v_manager boolean:=internal.has_role(array['manager']);
 v_coach boolean:=internal.has_role(array['coach']); v_player public.players; v_old public.player_evaluations;
 v_team public.teams; v_id uuid:=nullif(p_form->>'id','')::uuid; v_kind text; v_scores jsonb; v_priorities text[]; v_date date;
begin
 if auth.uid() is null or v_staff is null or not coalesce(v_manager or v_coach,false) then raise exception 'Not authorized' using errcode='42501'; end if;
 if jsonb_typeof(p_form)<>'object' or octet_length(p_form::text)>60000 then raise exception 'Invalid evaluation form'; end if;
 if v_id is not null then
  select * into v_old from public.player_evaluations where id=v_id for update;
  if not found then raise exception 'Evaluation not found'; end if;
  if v_old.status<>'draft' then raise exception 'Published evaluation cannot be edited'; end if;
  if v_old.player_id is distinct from p_form->>'playerId' then raise exception 'Player cannot be changed'; end if;
  if v_coach and v_old.coach_id is distinct from v_staff then raise exception 'Coach may edit own evaluations only' using errcode='42501'; end if;
 end if;
 select * into v_player from public.players where id=p_form->>'playerId' and archived_at is null for share;
 if not found then raise exception 'Player not found'; end if;
 if v_coach and not coalesce(internal.coach_has_player(v_staff,v_player.id),false) then raise exception 'Coach may evaluate assigned players only' using errcode='42501'; end if;
 select * into v_team from public.teams where id=case when v_id is null then v_player.team_id else coalesce(v_old.team_id,v_player.team_id) end for share;
 if not found or v_team.category_kind<>'team' then raise exception 'Player must be registered in an age category'; end if;
 if v_id is null and v_team.status<>'active' then raise exception 'Select a player in an active category'; end if;
 v_kind:=case when v_old.template_version=2 then v_old.evaluation_type when internal.is_goalkeeper(v_player.position) then 'goalkeeper' else 'outfield' end;
 v_scores:=coalesce(p_form->'detailedScores','{}'::jsonb);
 if p_form->>'periodType' is null or p_form->>'periodType' not in ('monthly','quarterly','custom') then raise exception 'Invalid evaluation period'; end if;
 v_date:=(p_form->>'evaluationDate')::date;
 if v_date is null then raise exception 'Evaluation date is required'; end if;
 if coalesce(p_form->'developmentPriorities','[]'::jsonb)='null'::jsonb or jsonb_typeof(coalesce(p_form->'developmentPriorities','[]'::jsonb))<>'array' then raise exception 'Invalid priorities'; end if;
 select coalesce(array_agg(value),'{}') into v_priorities from jsonb_array_elements_text(coalesce(p_form->'developmentPriorities','[]'::jsonb));
 if cardinality(v_priorities)>2 then raise exception 'At most two development priorities'; end if;
 if exists(select 1 from jsonb_each_text(p_form) where key in ('strengths','developmentAreas','coachNotes','coachRecommendation','trainingAction','finalRecommendation','nutritionPlan') and length(value)>5000)
 or exists(select 1 from jsonb_each_text(p_form) where key in ('evaluatorName','evaluatorSignature','coachSignature') and length(value)>200) then raise exception 'Evaluation text is too long'; end if;
 if v_id is null then
  insert into public.player_evaluations(player_id,team_id,team_name,coach_id,evaluation_date,period_type,evaluation_type,template_version,detailed_scores)
  values(v_player.id,v_team.id,v_team.name,v_staff,v_date,p_form->>'periodType',v_kind,2,v_scores) returning id into v_id;
 end if;
 update public.player_evaluations set evaluation_date=v_date,period_type=p_form->>'periodType',evaluation_type=v_kind,
 template_version=2,team_name=coalesce(v_old.team_name,v_team.name),detailed_scores=v_scores,
 strengths=nullif(btrim(p_form->>'strengths'),''),development_areas=nullif(btrim(p_form->>'developmentAreas'),''),
 coach_notes=nullif(btrim(p_form->>'coachNotes'),''),coach_recommendation=nullif(btrim(p_form->>'coachRecommendation'),''),
 development_priorities=v_priorities,training_action=nullif(btrim(p_form->>'trainingAction'),''),
 reassessment_date=nullif(p_form->>'reassessmentDate','')::date,final_recommendation=nullif(btrim(p_form->>'finalRecommendation'),''),
 height_cm=nullif(p_form->>'heightCm','')::numeric,weight_kg=nullif(p_form->>'weightKg','')::numeric,
 nutrition_plan=nullif(btrim(p_form->>'nutritionPlan'),''),evaluator_name=nullif(btrim(p_form->>'evaluatorName'),''),
 general_rating=nullif(p_form->>'generalRating',''),evaluator_signature=nullif(btrim(p_form->>'evaluatorSignature'),''),
 coach_signature=nullif(btrim(p_form->>'coachSignature'),''),updated_at=now(),row_version=row_version+1 where id=v_id;
 return v_id;
end $$;
revoke all on function internal.save_player_evaluation_v3(jsonb) from public,anon;
grant execute on function internal.save_player_evaluation_v3(jsonb) to authenticated;
create or replace function public.save_player_evaluation_v3(p_form jsonb) returns uuid
language sql security invoker set search_path='' as $$ select internal.save_player_evaluation_v3(p_form); $$;
revoke all on function public.save_player_evaluation_v3(jsonb) from public,anon;
grant execute on function public.save_player_evaluation_v3(jsonb) to authenticated;

-- Preserve existing access boundaries on replaced helpers.
revoke all on function internal.coach_has_player(text,text),internal.coach_has_team(text,text),internal.get_my_coach_team_ids(),internal.registration_team_for_birth_date(date) from public,anon;
notify pgrst,'reload schema';

-- Existing internal helper grants are explicit for fresh restoration as well.
grant execute on function internal.coach_has_player(text,text),internal.coach_has_team(text,text),internal.get_my_coach_team_ids(),internal.registration_team_for_birth_date(date),internal.delete_team_safely(text) to authenticated;
revoke all on function internal.delete_team_safely(text) from public,anon;

-- Keep database/API/report totals exact as well as the on-screen summaries.
create or replace function internal.pdf_evaluation_overall(p_kind text,p_scores jsonb) returns numeric
language sql immutable set search_path='' as $$
 with groups as (
  select key,value from jsonb_each(internal.evaluation_template_groups(p_kind))
 ), domain_scores as (
  select g.key,avg((p_scores->>k)::numeric) score
  from groups g cross join lateral jsonb_array_elements_text(g.value) k group by g.key
 ), criterion_scores as (
  select (p_scores->>k)::numeric score from groups g cross join lateral jsonb_array_elements_text(g.value) k
 )
 select case when p_kind='goalkeeper' then
  (select case when count(score)=10 then round(sum(score)/10,2) end from criterion_scores)
 else (select case when count(score)=5 then round(avg(score),2) end from domain_scores) end;
$$;
revoke all on function internal.pdf_evaluation_overall(text,jsonb) from public,anon;
grant execute on function internal.pdf_evaluation_overall(text,jsonb) to authenticated;
alter table public.player_evaluations alter column overall_score set expression as (
 case when template_version=2 then internal.pdf_evaluation_overall(evaluation_type,detailed_scores)
 when technical_score is not null and tactical_score is not null and physical_score is not null and mental_score is not null and discipline_score is not null
 then round((technical_score+tactical_score+physical_score+mental_score+discipline_score)::numeric/5,2)
 else null::numeric end
);
