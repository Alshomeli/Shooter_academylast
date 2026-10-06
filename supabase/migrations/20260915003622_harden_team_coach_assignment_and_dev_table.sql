create or replace function internal.guard_team_coach_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  if tg_op = 'UPDATE' and new.coach_id is distinct from old.coach_id then
    if not internal.has_role(array['manager']::text[]) then
      raise exception 'Only academy managers can change a team coach assignment';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function internal.guard_team_coach_assignment() from public;
grant execute on function internal.guard_team_coach_assignment() to postgres;

drop trigger if exists trg_guard_team_coach_assignment on public.teams;
create trigger trg_guard_team_coach_assignment
before update on public.teams
for each row execute function internal.guard_team_coach_assignment();

-- Remove accidental public/API exposure of the development-only table when it exists.
DO $body$
BEGIN
  IF to_regclass('public.some_table') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read some_table" ON public.some_table';
    EXECUTE 'REVOKE ALL ON public.some_table FROM anon, authenticated';
    EXECUTE 'COMMENT ON TABLE public.some_table IS ''Development-only table; intentionally not exposed to anon/authenticated API roles.''';
  END IF;
END
$body$;
