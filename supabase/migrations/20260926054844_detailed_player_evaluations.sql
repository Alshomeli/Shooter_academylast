alter table public.player_evaluations
  add column if not exists detailed_scores jsonb not null default '{}'::jsonb,
  add column if not exists development_priorities text[] not null default '{}'::text[],
  add column if not exists training_action text,
  add column if not exists reassessment_date date,
  add column if not exists final_recommendation text



alter table public.player_evaluations
  drop constraint if exists player_evaluations_detailed_scores_object,
  add constraint player_evaluations_detailed_scores_object
    check (jsonb_typeof(detailed_scores) = 'object'),
  drop constraint if exists player_evaluations_development_priorities_limit,
  add constraint player_evaluations_development_priorities_limit
    check (cardinality(development_priorities) <= 2),
  drop constraint if exists player_evaluations_reassessment_date_valid,
  add constraint player_evaluations_reassessment_date_valid
    check (reassessment_date is null or reassessment_date >= evaluation_date)



create or replace function internal.save_player_evaluation_v2_impl(
  p_evaluation_id uuid,
  p_player_id text,
  p_evaluation_date date,
  p_period_type text,
  p_technical_score smallint,
  p_tactical_score smallint,
  p_physical_score smallint,
  p_mental_score smallint,
  p_discipline_score smallint,
  p_strengths text,
  p_development_areas text,
  p_coach_notes text,
  p_coach_recommendation text,
  p_detailed_scores jsonb,
  p_development_priorities text[],
  p_training_action text,
  p_reassessment_date date,
  p_final_recommendation text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
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
  if v_is_coach and not internal.is_coach_of_team(v_player.team_id) then raise exception 'Coach may evaluate assigned team players only'; end if;

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
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_team(v_eval.team_id)) then
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
$$



create or replace function public.save_player_evaluation_v2(
  p_evaluation_id uuid,
  p_player_id text,
  p_evaluation_date date,
  p_period_type text,
  p_technical_score smallint,
  p_tactical_score smallint,
  p_physical_score smallint,
  p_mental_score smallint,
  p_discipline_score smallint,
  p_strengths text,
  p_development_areas text,
  p_coach_notes text,
  p_coach_recommendation text,
  p_detailed_scores jsonb,
  p_development_priorities text[],
  p_training_action text,
  p_reassessment_date date,
  p_final_recommendation text
) returns uuid
language sql set search_path = ''
as $$
  select internal.save_player_evaluation_v2_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18);
$$



revoke all on function public.save_player_evaluation_v2(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text,jsonb,text[],text,date,text) from public, anon


grant execute on function public.save_player_evaluation_v2(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text,jsonb,text[],text,date,text) to authenticated
