-- STAGING ONLY. No scheduler is enabled by this migration.
-- A scheduled service may invoke this routine daily after isolated DB validation.
-- Each player creates at most one renewal, and existing billing is preserved.
create or replace function public.issue_due_monthly_renewals(p_as_of date default current_date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_staff public.staff;
 v_row record;
 v_id text;
 v_issued int := 0;
 v_skipped int := 0;
begin
 select * into v_staff from public.staff where user_id=auth.uid()
 and status='active' and role='manager' limit 1;
 if v_staff.id is null then raise exception 'Active manager required'; end if;
 if p_as_of is null or p_as_of<>current_date then raise exception 'Only current date supported'; end if;
 for v_row in
  select distinct on (s.player_id) s.player_id,s.end_date
  from public.subscriptions s
  join public.players pl on pl.id=s.player_id
  where s.plan_type='monthly'
    and s.status='paid'
    and pl.status='active'
    and s.end_date < p_as_of
    and not exists (
      select 1 from public.subscriptions future
      where future.player_id=s.player_id and future.end_date>s.end_date
    )
  order by s.player_id,s.end_date desc
  limit 500
 loop
  begin
    v_id:=public.issue_player_monthly_renewal(v_row.player_id,p_as_of);
    v_issued:=v_issued+1;
  exception when others then
    -- Skip conflicting players without aborting unrelated renewals.
    v_skipped:=v_skipped+1;
  end;
 end loop;
 return pg_catalog.jsonb_build_object('issued_or_existing',v_issued,'skipped',v_skipped,'as_of',p_as_of);
end
$$;
revoke all on function public.issue_due_monthly_renewals(date) from public,anon;
grant execute on function public.issue_due_monthly_renewals(date) to authenticated;
