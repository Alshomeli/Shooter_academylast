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
        and pa.user_id = auth.uid()
    )
  )
);

drop policy if exists select_player_documents_bucket_staff_roles on storage.objects;
create policy select_player_documents_bucket_staff_roles
on storage.objects
for select
to authenticated
using (
  bucket_id = 'player-documents'
  and (
    internal.has_role(array['manager'::text,'receptionist'::text])
    or (
      internal.has_role(array['coach'::text])
      and exists (
        select 1 from public.players p
        where p.id::text = (storage.foldername(objects.name))[1]
          and internal.is_coach_of_team(p.team_id)
      )
    )
    or (
      internal.has_role(array['parent'::text])
      and exists (
        select 1
        from public.players p
        join public.parents pa on pa.id = p.parent_id
        where p.id::text = (storage.foldername(objects.name))[1]
          and pa.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists select_approved_registration_player_files on storage.objects;
create policy select_approved_registration_player_files
on storage.objects
for select
to authenticated
using (
  bucket_id = 'player-documents'
  and (storage.foldername(name))[1] = 'applications'
  and exists (
    select 1
    from public.player_documents d
    join public.players p on p.id = d.player_id
    where d.file_path = objects.name
      and (
        internal.has_role(array['manager'::text,'receptionist'::text])
        or (internal.has_role(array['coach'::text]) and internal.is_coach_of_team(p.team_id))
        or (internal.has_role(array['parent'::text]) and internal.is_parent_of_player(p.id))
      )
  )
);
