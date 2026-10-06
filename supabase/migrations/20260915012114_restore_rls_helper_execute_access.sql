grant execute on function internal.is_coach_of_team(text) to authenticated;

comment on function internal.is_coach_of_team(text) is 'SECURITY DEFINER helper used by RLS policies to determine whether the current authenticated user is the active coach assigned to a team. EXECUTE is limited to authenticated callers.';
