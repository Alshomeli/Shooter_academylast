-- Mirror the already deployed, parent-only academy activities endpoint.
-- Explicit field allowlists exclude private notes, scorers, player and payment records.
begin;
CREATE OR REPLACE FUNCTION public.get_parent_academy_activities()
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
revoke all on function public.get_parent_academy_activities() from public, anon;
grant execute on function public.get_parent_academy_activities() to authenticated;
commit;
