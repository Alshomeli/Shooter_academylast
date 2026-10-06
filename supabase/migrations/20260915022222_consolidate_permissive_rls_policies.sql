drop policy if exists select_notifications_authenticated on public.notifications;
drop policy if exists select_notifications_parent_own on public.notifications;
create policy select_notifications_authenticated on public.notifications
for select to authenticated
using (
  (recipient_user_id = (select auth.uid()))
  or
  (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant']::text[])))
);

drop policy if exists update_notifications_parent_own on public.notifications;
drop policy if exists update_notifications_recipient_or_staff on public.notifications;
create policy update_notifications_recipient_or_staff on public.notifications
for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  or
  (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant']::text[])))
)
with check (
  recipient_user_id = (select auth.uid())
  or
  (recipient_user_id is null and (select internal.has_role(array['manager','coach','receptionist','accountant']::text[])))
);

drop policy if exists select_subscriptions_authenticated on public.subscriptions;
drop policy if exists select_subscriptions_parent_own_children on public.subscriptions;
create policy select_subscriptions_authenticated on public.subscriptions
for select to authenticated
using (
  (select internal.has_role(array['manager','accountant','receptionist']::text[]))
  or
  (
    (select internal.has_role(array['parent']::text[]))
    and exists (
      select 1
      from public.players p
      join public.parents pa on pa.id = p.parent_id
      where p.id = subscriptions.player_id
        and pa.user_id = (select auth.uid())
    )
  )
);

-- Recreate the staff policies explicitly with initPlan-safe auth calls.
drop policy if exists insert_staff_authorized on public.staff;
create policy insert_staff_authorized on public.staff
for insert to authenticated
with check (
  (select internal.has_role(array['manager']::text[]))
  or (
    id = ((select auth.uid())::text)
    and status = 'pending'
    and role = any(array['coach','receptionist','accountant','parent']::text[])
    and coalesce(salary,0) = 0
    and lower(email) = lower((select auth.jwt() ->> 'email'))
    and user_id = (select auth.uid())
  )
);

drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_self_or_staff_roles on public.staff
for select to authenticated
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  or id = ((select auth.uid())::text)
  or (select internal.has_role(array['manager','coach','receptionist','accountant']::text[]))
);
