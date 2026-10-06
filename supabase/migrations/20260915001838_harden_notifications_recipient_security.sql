alter table public.notifications add column if not exists recipient_user_id uuid;
alter table public.notifications drop constraint if exists notifications_recipient_user_id_fkey;
alter table public.notifications add constraint notifications_recipient_user_id_fkey foreign key (recipient_user_id) references auth.users(id) on delete cascade;
create index if not exists idx_notifications_recipient_created on public.notifications(recipient_user_id, created_at desc);

create or replace function internal.validate_notification_recipient()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  if new.recipient_user_id is not null and not exists (select 1 from auth.users u where u.id = new.recipient_user_id) then
    raise exception 'Invalid notification recipient';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_notification_recipient on public.notifications;
create trigger trg_validate_notification_recipient
before insert or update of recipient_user_id on public.notifications
for each row execute function internal.validate_notification_recipient();

drop policy if exists select_notifications_authenticated on public.notifications;
drop policy if exists update_notifications_staff_roles on public.notifications;
drop policy if exists delete_notifications_staff_roles on public.notifications;

create policy select_notifications_authenticated on public.notifications
for select to authenticated
using (
  (recipient_user_id is not null and recipient_user_id = (select auth.uid()))
  or
  (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant'])))
);

create policy update_notifications_recipient_or_staff on public.notifications
for update to authenticated
using (
  (recipient_user_id = (select auth.uid()))
  or (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant'])))
)
with check (
  (recipient_user_id = (select auth.uid()))
  or (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant'])))
);

create policy delete_notifications_staff_roles on public.notifications
for delete to authenticated
using (
  (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant'])))
);

create policy select_notifications_parent_own on public.notifications
for select to authenticated
using (
  (recipient_user_id = (select auth.uid()))
  and (select internal.has_role(array['parent']))
);

create policy update_notifications_parent_own on public.notifications
for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  and (select internal.has_role(array['parent']))
)
with check (
  recipient_user_id = (select auth.uid())
  and (select internal.has_role(array['parent']))
);

revoke all on function internal.validate_notification_recipient() from public;
revoke all on function internal.validate_notification_recipient() from anon;
revoke all on function internal.validate_notification_recipient() from authenticated;

