-- Archive players without deleting financial, attendance or registration history.
-- No client direct update is granted: the manager role is validated server-side.
create or replace function public.archive_player_safely(p_player_id text)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if (select internal.has_role(array['manager'::text])) is not true then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  update public.players
     set archived_at = coalesce(archived_at, now()),
         status = 'inactive'
   where id = p_player_id;
  if not found then
    raise exception 'Player not found' using errcode='P0002';
  end if;
  return jsonb_build_object('success',true,'archived',true,'playerId',p_player_id);
end;
$$;

revoke all on function public.archive_player_safely(text) from public, anon;
grant execute on function public.archive_player_safely(text) to authenticated;
