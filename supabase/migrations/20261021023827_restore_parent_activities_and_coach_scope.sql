CREATE OR REPLACE FUNCTION internal.get_parent_academy_activities()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
  if (select auth.uid()) is null or not internal.has_role(array['parent']::text[]) then
    raise exception 'Not authorized to view parent activities' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'ageGroup', t.age_group
      ) order by t.name)
      from public.teams t
    ), '[]'::jsonb),
    'trainings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'teamId', x.team_id, 'title', x.title,
        'sessionDate', x.session_date, 'durationMinutes', x.duration_minutes,
        'status', x.status
      ) order by x.session_date desc, x.id)
      from (select id, team_id, title, session_date, duration_minutes, status
            from public.trainings order by session_date desc, id limit 500) x
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'teamId', x.team_id, 'opponent', x.opponent,
        'matchDate', x.match_date, 'location', x.location,
        'result', x.result, 'academyScore', x.academy_score,
        'opponentScore', x.opponent_score
      ) order by x.match_date desc, x.id)
      from (select id, team_id, opponent, match_date, location,
                   result, academy_score, opponent_score
            from public.matches order by match_date desc, id limit 500) x
    ), '[]'::jsonb),
    'tournaments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'organizer', x.organizer,
        'season', x.season, 'startDate', x.start_date,
        'endDate', x.end_date, 'teamsCount', x.teams_count
      ) order by x.start_date desc, x.id)
      from (select id, name, organizer, season, start_date, end_date, teams_count
            from public.tournaments order by start_date desc, id limit 500) x
    ), '[]'::jsonb)
  );
end;$function$
;

revoke all on function internal.get_parent_academy_activities() from public, anon;
grant execute on function internal.get_parent_academy_activities() to authenticated;
create or replace function public.get_parent_academy_activities() returns jsonb
language sql stable security invoker set search_path='' as $$
 select internal.get_parent_academy_activities();
$$;
revoke all on function public.get_parent_academy_activities() from public, anon;
grant execute on function public.get_parent_academy_activities() to authenticated;

-- Return only team identifiers; no supervisor profile or private staff fields.
create or replace function internal.get_my_coach_team_ids() returns text[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(t.id),array[]::text[])
 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.teams t on (supervisor.coach_kind='goalkeeper' or (supervisor.coach_kind='team' and t.coach_id=supervisor.id))
 where auth.uid() is not null and actor.user_id=auth.uid()
 and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active';
$$;
revoke all on function internal.get_my_coach_team_ids() from public,anon;
grant execute on function internal.get_my_coach_team_ids() to authenticated;
create or replace function public.get_my_coach_team_ids() returns text[]
language sql stable security invoker set search_path='' as $$
 select internal.get_my_coach_team_ids();
$$;
revoke all on function public.get_my_coach_team_ids() from public,anon;
grant execute on function public.get_my_coach_team_ids() to authenticated;
notify pgrst, 'reload schema';
