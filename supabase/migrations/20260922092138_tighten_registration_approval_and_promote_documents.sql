create unique index if not exists uq_player_documents_file_path on public.player_documents(file_path);

create or replace function internal.promote_registration_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approved_player_id is not null
     and (old.approved_player_id is distinct from new.approved_player_id) then
    insert into public.player_documents(
      player_id,file_name,file_path,file_type,file_category,file_size,uploaded_at
    ) values (
      new.approved_player_id,new.file_name,new.storage_path,new.mime_type,new.file_category,new.file_size,new.uploaded_at
    )
    on conflict (file_path) do update set
      player_id = excluded.player_id,
      file_name = excluded.file_name,
      file_type = excluded.file_type,
      file_category = excluded.file_category,
      file_size = excluded.file_size;
  end if;
  return new;
end;
$$;
revoke execute on function internal.promote_registration_document() from public, anon, authenticated;
grant execute on function internal.promote_registration_document() to postgres, service_role;

drop trigger if exists trg_promote_registration_document on public.registration_documents;
create trigger trg_promote_registration_document
after update of approved_player_id on public.registration_documents
for each row
when (new.approved_player_id is not null)
execute function internal.promote_registration_document();

create or replace function internal.guard_registration_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status in ('under_review','approved','rejected') then
    raise exception 'Draft registration must be submitted before review or approval';
  end if;
  if old.status = 'needs_info' and new.status in ('under_review','approved') then
    raise exception 'Registration needing information must be resubmitted before review or approval';
  end if;
  return new;
end;
$$;
revoke execute on function internal.guard_registration_workflow_status() from public, anon, authenticated;
grant execute on function internal.guard_registration_workflow_status() to postgres, service_role;

drop trigger if exists trg_guard_registration_workflow_status on public.registration_applications;
create trigger trg_guard_registration_workflow_status
before update of status on public.registration_applications
for each row execute function internal.guard_registration_workflow_status();

create policy "select_approved_registration_player_files"
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
    where d.file_path = storage.objects.name
      and (
        internal.has_role(array['manager','accountant','receptionist'])
        or (internal.has_role(array['coach']) and internal.is_coach_of_team(p.team_id))
        or (
          internal.has_role(array['parent'])
          and internal.is_parent_of_player(p.id)
        )
      )
  )
);
