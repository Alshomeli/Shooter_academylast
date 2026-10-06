create or replace function internal.current_staff_id()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id text;
begin
  select s.id into v_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.status = 'active'
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  select s.id into v_id
  from public.staff s
  where s.user_id is null
    and s.status = 'active'
    and lower(s.email) = lower((select auth.jwt() ->> 'email'))
  limit 1;
  return v_id;
end;
$function$;

grant execute on function internal.current_staff_id() to authenticated;
revoke execute on function internal.current_staff_id() from anon;

-- Staff creation is performed by the manager-only Staff UI. The old self-insert
-- path is no longer used because parent onboarding is handled by parent-register.
drop policy if exists insert_staff_authorized on public.staff;
create policy insert_staff_manager_only on public.staff
for insert to authenticated
with check ((select internal.has_role(array['manager']::text[])));

drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_self_or_staff_roles on public.staff
for select to authenticated
using (
  id = (select internal.current_staff_id())
  or (select internal.has_role(array['manager','coach','receptionist','accountant']::text[]))
);
