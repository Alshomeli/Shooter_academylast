create table if not exists public.player_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  coach_id text references public.staff(id) on delete set null,
  evaluation_date date not null default current_date,
  period_type text not null default 'monthly' check (period_type = any (array['monthly'::text,'quarterly'::text,'custom'::text])),
  technical_score smallint check (technical_score is null or technical_score between 1 and 5),
  tactical_score smallint check (tactical_score is null or tactical_score between 1 and 5),
  physical_score smallint check (physical_score is null or physical_score between 1 and 5),
  mental_score smallint check (mental_score is null or mental_score between 1 and 5),
  discipline_score smallint check (discipline_score is null or discipline_score between 1 and 5),
  strengths text,
  development_areas text,
  coach_notes text,
  coach_recommendation text,
  status text not null default 'draft' check (status = any (array['draft'::text,'published'::text])),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 0,
  overall_score numeric(4,2) generated always as (
    case when technical_score is not null and tactical_score is not null and physical_score is not null and mental_score is not null and discipline_score is not null
      then round((technical_score + tactical_score + physical_score + mental_score + discipline_score)::numeric / 5, 2)
      else null end
  ) stored,
  check (status <> 'published' or (
    technical_score is not null and tactical_score is not null and physical_score is not null and mental_score is not null and discipline_score is not null and published_at is not null
  ))
)



create index if not exists idx_player_evaluations_player_date on public.player_evaluations(player_id, evaluation_date desc)


create index if not exists idx_player_evaluations_team_date on public.player_evaluations(team_id, evaluation_date desc)


create index if not exists idx_player_evaluations_coach on public.player_evaluations(coach_id)


create index if not exists idx_player_evaluations_status on public.player_evaluations(status)



alter table public.player_evaluations enable row level security



revoke all on public.player_evaluations from anon


revoke insert, update, delete on public.player_evaluations from authenticated


grant select on public.player_evaluations to authenticated



create policy player_evaluations_select_authorized
on public.player_evaluations
for select
to authenticated
using (
  internal.has_role(array['manager'::text])
  or (internal.has_role(array['coach'::text]) and internal.is_coach_of_team(team_id))
  or (internal.has_role(array['parent'::text]) and status = 'published' and internal.is_parent_of_player(player_id))
)



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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff public.staff%rowtype;
  v_player public.players%rowtype;
  v_eval public.player_evaluations%rowtype;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_staff
  from public.staff
  where user_id = v_user_id and status = 'active' and role in ('manager','coach')
  limit 1;
  if v_staff.id is null then raise exception 'Not authorized'; end if;

  if p_period_type not in ('monthly','quarterly','custom') then raise exception 'Invalid evaluation period'; end if;
  if p_evaluation_date is null then raise exception 'Evaluation date is required'; end if;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'Player not found'; end if;

  if v_staff.role = 'coach' and not internal.is_coach_of_team(v_player.team_id) then
    raise exception 'Coach may evaluate assigned team players only';
  end if;

  if p_evaluation_id is null then
    insert into public.player_evaluations(
      player_id, team_id, coach_id, evaluation_date, period_type,
      technical_score, tactical_score, physical_score, mental_score, discipline_score,
      strengths, development_areas, coach_notes, coach_recommendation
    ) values (
      v_player.id, nullif(v_player.team_id,''), v_staff.id, p_evaluation_date, p_period_type,
      p_technical_score, p_tactical_score, p_physical_score, p_mental_score, p_discipline_score,
      nullif(trim(p_strengths),''), nullif(trim(p_development_areas),''), nullif(trim(p_coach_notes),''), nullif(trim(p_coach_recommendation),'')
    ) returning id into v_id;
    return v_id;
  end if;

  select * into v_eval from public.player_evaluations where id = p_evaluation_id for update;
  if v_eval.id is null then raise exception 'Evaluation not found'; end if;
  if v_eval.status <> 'draft' then raise exception 'Published evaluation cannot be edited'; end if;
  if v_eval.player_id <> p_player_id then raise exception 'Player cannot be changed'; end if;
  if v_staff.role = 'coach' and v_eval.coach_id <> v_staff.id then raise exception 'Coach may edit own draft evaluations only'; end if;

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
      updated_at = now(),
      row_version = row_version + 1
  where id = p_evaluation_id;

  return p_evaluation_id;
end;
$$



create or replace function public.publish_player_evaluation(p_evaluation_id uuid)
returns public.player_evaluations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff public.staff%rowtype;
  v_eval public.player_evaluations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_staff
  from public.staff
  where user_id = v_user_id and status = 'active' and role in ('manager','coach')
  limit 1;
  if v_staff.id is null then raise exception 'Not authorized'; end if;

  select * into v_eval from public.player_evaluations where id = p_evaluation_id for update;
  if v_eval.id is null then raise exception 'Evaluation not found'; end if;
  if v_eval.status <> 'draft' then raise exception 'Evaluation is already published'; end if;

  if v_staff.role = 'coach' then
    if v_eval.coach_id <> v_staff.id or not internal.is_coach_of_team(v_eval.team_id) then
      raise exception 'Coach may publish own assigned-team evaluations only';
    end if;
  end if;

  if v_eval.technical_score is null or v_eval.tactical_score is null or v_eval.physical_score is null or v_eval.mental_score is null or v_eval.discipline_score is null then
    raise exception 'All evaluation scores are required before publishing';
  end if;

  update public.player_evaluations
  set status = 'published', published_at = now(), updated_at = now(), row_version = row_version + 1
  where id = p_evaluation_id
  returning * into v_eval;

  return v_eval;
end;
$$



revoke all on function public.save_player_evaluation(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text) from public, anon


grant execute on function public.save_player_evaluation(uuid,text,date,text,smallint,smallint,smallint,smallint,smallint,text,text,text,text) to authenticated


revoke all on function public.publish_player_evaluation(uuid) from public, anon


grant execute on function public.publish_player_evaluation(uuid) to authenticated



comment on table public.player_evaluations is 'Historical player performance evaluations. Coaches can evaluate only players on their assigned team; parents can read published evaluations for their own children.'
