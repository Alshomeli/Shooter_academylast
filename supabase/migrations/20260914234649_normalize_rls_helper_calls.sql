drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_self_or_staff_roles on public.staff for select to authenticated using ((lower(email) = lower((select auth.jwt() ->> 'email'))) or (id = (select auth.uid())::text) or (select internal.has_role(ARRAY['manager','coach','receptionist','accountant'])));

drop policy if exists insert_staff_authorized on public.staff;
create policy insert_staff_authorized on public.staff for insert to authenticated with check ((select internal.has_role(ARRAY['manager'])) or ((id = (select auth.uid())::text) and status = 'pending' and role = any(ARRAY['coach','receptionist','accountant','parent']) and coalesce(salary,0)=0 and lower(email)=lower((select auth.jwt() ->> 'email')) and user_id=(select auth.uid())));

drop policy if exists select_players_authenticated on public.players;
create policy select_players_authenticated on public.players for select to authenticated using ((select internal.has_role(ARRAY['manager','accountant','coach','receptionist'])) or ((select internal.has_role(ARRAY['parent'])) and coalesce(parent_email,'') <> '' and lower(coalesce(parent_email,'')) = lower(coalesce((select auth.jwt() ->> 'email'),''))));

drop policy if exists insert_players_authorized on public.players;
create policy insert_players_authorized on public.players for insert to authenticated with check ((select internal.has_role(ARRAY['manager','coach','receptionist'])) or ((select internal.has_role(ARRAY['parent'])) and lower(coalesce(parent_email,'')) = lower(coalesce((select auth.jwt() ->> 'email'),'')) and coalesce(parent_email,'') <> ''));

drop policy if exists select_attendance_authenticated on public.attendance;
create policy select_attendance_authenticated on public.attendance for select to authenticated using ((select internal.has_role(ARRAY['manager','accountant','coach','receptionist'])) or ((select internal.has_role(ARRAY['parent'])) and exists (select 1 from public.players p where p.id=attendance.player_id and coalesce(p.parent_email,'')<>'' and lower(p.parent_email)=lower(coalesce((select auth.jwt() ->> 'email'),'')))));
