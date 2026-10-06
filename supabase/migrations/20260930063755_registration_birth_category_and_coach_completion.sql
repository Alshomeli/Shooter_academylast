create or replace function internal.registration_team_for_birth_date(p_birth_date date)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_year text; v_team_id text; v_age integer;
begin
 if p_birth_date is null then return null; end if;
 v_year:=extract(year from p_birth_date)::int::text;
 select t.id into v_team_id from public.teams t where t.name ~ ('(^|[^0-9])'||v_year||'([^0-9]|$)') order by t.created_at limit 1;
 if v_team_id is not null then return v_team_id; end if;
 v_age:=extract(year from age(current_date,p_birth_date))::int;
 select t.id into v_team_id from public.teams t where replace(upper(t.age_group),'-','')='U'||(v_age+1)::text order by t.created_at limit 1;
 return v_team_id;
end $$;
revoke all on function internal.registration_team_for_birth_date(date) from public,anon,authenticated;

create or replace function internal.finalize_registered_player(p_player_id text,p_team_id text default null,p_position text default null,p_jersey_number integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_player public.players%rowtype; v_team public.teams%rowtype; v_actor public.staff%rowtype; v_auto_team text;
begin
 select s.* into v_actor from public.staff s where s.user_id=(select auth.uid()) and s.status='active' limit 1;
 if not found or v_actor.role not in ('manager','coach') then raise exception 'Manager or coach authorization required' using errcode='42501'; end if;
 select * into v_player from public.players where id=p_player_id for update;
 if not found then raise exception 'Player not found'; end if;
 if not exists(select 1 from public.registration_children c join public.registration_applications a on a.id=c.application_id where c.approved_player_id=p_player_id and a.status='approved') then raise exception 'Approved registration required'; end if;
 v_auto_team:=internal.registration_team_for_birth_date(v_player.birth_date);
 if v_auto_team is null then raise exception 'No team matches the player birth category'; end if;
 select * into v_team from public.teams where id=v_auto_team;
 if v_actor.role='coach' and v_team.coach_id<>v_actor.id then raise exception 'Coach may only update their team' using errcode='42501'; end if;
 if p_jersey_number is not null and p_jersey_number>0 and exists(select 1 from public.players where team_id=v_auto_team and jersey_number=p_jersey_number and id<>p_player_id) then raise exception 'Jersey number is already used in the selected team'; end if;
 update public.players set team_id=v_auto_team,
 position=coalesce(nullif(trim(coalesce(p_position,'')),''),position),
 jersey_number=case when coalesce(p_jersey_number,0)>0 then p_jersey_number else jersey_number end,
 status='active' where id=p_player_id returning * into v_player;
 if v_team.coach_id is not null then
  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  select 'notif-'||gen_random_uuid()::text,'لاعب جديد في فريقك','تم إسناد '||v_player.name||' إلى '||v_team.name||'. يمكنك استكمال المركز ورقم القميص.',now()::text,'registration',false,s.user_id
  from public.staff s where s.id=v_team.coach_id and s.user_id is not null and s.status='active';
 end if;
 return jsonb_build_object('success',true,'playerId',v_player.id,'teamId',v_player.team_id,'position',v_player.position,'jerseyNumber',v_player.jersey_number,'status',v_player.status,'coachId',v_team.coach_id);
end $$;

create or replace function public.finalize_registered_player(p_player_id text,p_team_id text default null,p_position text default null,p_jersey_number integer default null)
returns jsonb language sql set search_path='' as $$select internal.finalize_registered_player($1,$2,$3,$4)$$;
revoke all on function public.finalize_registered_player(text,text,text,integer) from public,anon;
grant execute on function public.finalize_registered_player(text,text,text,integer) to authenticated;
