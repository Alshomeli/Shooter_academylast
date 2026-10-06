create or replace function internal.guard_player_national_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text := coalesce((select auth.jwt()->>'role'), '');
  allowed boolean := internal.has_role(array['manager'::text, 'receptionist'::text]);
begin
  if jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if nullif(trim(coalesce(new.national_id, '')), '') is not null and not allowed then
      raise exception 'Only managers or receptionists can set player national ID'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.national_id is distinct from old.national_id and not allowed then
      raise exception 'Only managers or receptionists can modify player national ID'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.guard_player_national_id() from public, anon, authenticated;

drop trigger if exists trg_guard_player_national_id_insert on public.players;
create trigger trg_guard_player_national_id_insert
before insert on public.players
for each row execute function internal.guard_player_national_id();

drop trigger if exists trg_guard_player_national_id_update on public.players;
create trigger trg_guard_player_national_id_update
before update of national_id on public.players
for each row execute function internal.guard_player_national_id();

create or replace function internal.get_player_identity_private()
returns table(id text, national_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.national_id
  from public.players p
  where (select internal.is_academy_admin())
$$;

revoke all on function internal.get_player_identity_private() from public, anon;
grant execute on function internal.get_player_identity_private() to authenticated;

create or replace function public.get_player_identity_private()
returns table(id text, national_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from internal.get_player_identity_private()
$$;

revoke all on function public.get_player_identity_private() from public, anon;
grant execute on function public.get_player_identity_private() to authenticated;
