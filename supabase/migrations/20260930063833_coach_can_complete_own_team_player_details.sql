create or replace function internal.update_team_player_technical_assignment(p_player_id text,p_position text default null,p_jersey_number integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.staff%rowtype; v_player public.players%rowtype; v_team public.teams%rowtype;
begin
 select * into v_actor from public.staff where user_id=(select auth.uid()) and status='active' limit 1;
 if not found or v_actor.role not in ('manager','coach') then raise exception 'Manager or coach authorization required' using errcode='42501'; end if;
 select * into v_player from public.players where id=p_player_id for update;
 if not found then raise exception 'Player not found'; end if;
 if v_player.team_id is null then raise exception 'Player must be assigned to a team first'; end if;
 select * into v_team from public.teams where id=v_player.team_id;
 if v_actor.role='coach' and v_team.coach_id<>v_actor.id then raise exception 'Coach may only update players in their own team' using errcode='42501'; end if;
 if p_jersey_number is not null and p_jersey_number>0 and exists(select 1 from public.players where team_id=v_player.team_id and jersey_number=p_jersey_number and id<>p_player_id) then raise exception 'Jersey number is already used in the team'; end if;
 update public.players set
  position=coalesce(nullif(trim(coalesce(p_position,'')),''),position),
  jersey_number=case when coalesce(p_jersey_number,0)>0 then p_jersey_number else jersey_number end
 where id=p_player_id returning * into v_player;
 return jsonb_build_object('success',true,'playerId',v_player.id,'teamId',v_player.team_id,'position',v_player.position,'jerseyNumber',v_player.jersey_number);
end $$;
create or replace function public.update_team_player_technical_assignment(p_player_id text,p_position text default null,p_jersey_number integer default null)
returns jsonb language sql set search_path='' as $$select internal.update_team_player_technical_assignment($1,$2,$3)$$;
revoke all on function public.update_team_player_technical_assignment(text,text,integer) from public,anon;
grant execute on function public.update_team_player_technical_assignment(text,text,integer) to authenticated;
