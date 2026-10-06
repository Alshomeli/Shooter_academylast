drop policy if exists select_player_documents_staff_roles on public.player_documents;
create policy select_player_documents_staff_roles
on public.player_documents
for select
to authenticated
using (
  internal.has_role(array['manager'::text,'receptionist'::text])
  or (
    internal.has_role(array['coach'::text])
    and exists (
      select 1 from public.players p
      where p.id = player_documents.player_id
        and internal.is_coach_of_team(p.team_id)
    )
  )
  or (
    internal.has_role(array['parent'::text])
    and exists (
      select 1
      from public.players p
      join public.parents pa on pa.id = p.parent_id
      where p.id = player_documents.player_id
        and pa.user_id = (select auth.uid())
    )
  )
);
