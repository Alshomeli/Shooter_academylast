create or replace function internal.save_player_evaluation_impl(
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
  p_coach_recommendation text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_is_coach and not internal.is_coach_of_team(v_player.team_id) then
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
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_team(v_eval.team_id)) then
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
$$



create or replace function internal.publish_player_evaluation_impl(p_evaluation_id uuid)
returns public.player_evaluations
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_is_coach and (v_eval.coach_id <> v_staff_id or not internal.is_coach_of_team(v_eval.team_id)) then
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
$$



create or replace function public.save_player_evaluation(
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
  p_coach_recommendation text
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal.save_player_evaluation_impl($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);
$$



create or replace function public.publish_player_evaluation(p_evaluation_id uuid)
returns public.player_evaluations
language sql
security invoker
set search_path = ''
as $$
  select internal.publish_player_evaluation_impl($1);
$$



grant execute on function internal.save_player_evaluation_impl(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text) to authenticated


grant execute on function internal.publish_player_evaluation_impl(uuid) to authenticated


grant execute on function public.save_player_evaluation(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text) to authenticated


grant execute on function public.publish_player_evaluation(uuid) to authenticated
