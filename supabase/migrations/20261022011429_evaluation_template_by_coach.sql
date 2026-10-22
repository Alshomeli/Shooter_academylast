-- Resolve only the signed-in coach's template. Assistants inherit their active
-- supervising coach's specialization without exposing the supervisor's staff row.
create or replace function internal.current_evaluation_kind() returns text
language sql stable security definer set search_path='' as $$
 select case supervisor.coach_kind when 'goalkeeper' then 'goalkeeper' when 'team' then 'outfield' end
 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 where auth.uid() is not null and actor.id=internal.current_staff_id()
 and actor.user_id=auth.uid() and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active';
$$;
revoke all on function internal.current_evaluation_kind() from public,anon;
grant execute on function internal.current_evaluation_kind() to authenticated;

create or replace function public.get_my_evaluation_kind() returns text
language sql stable security invoker set search_path='' as $$
 select internal.current_evaluation_kind();
$$;
revoke all on function public.get_my_evaluation_kind() from public,anon;
grant execute on function public.get_my_evaluation_kind() to authenticated;

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
 -- Existing evaluations retain their recorded template. New templates follow the
 -- authenticated coach (or the manager's explicit selection), never player position alone.
 if v_old.template_version=2 then
  v_kind:=v_old.evaluation_type;
 elsif v_manager then
  v_kind:=coalesce(nullif(p_form->>'evaluationType',''),'outfield');
  if v_kind not in ('outfield','goalkeeper') then raise exception 'Invalid evaluation type'; end if;
 else
  v_kind:=internal.current_evaluation_kind();
  if v_kind is null then raise exception 'Active coach specialization is required' using errcode='42501'; end if;
 end if;
 if v_kind='goalkeeper' and not internal.is_goalkeeper(v_player.position) then
  raise exception 'Goalkeeper evaluation is only available for goalkeepers';
 end if;
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

notify pgrst,'reload schema';
