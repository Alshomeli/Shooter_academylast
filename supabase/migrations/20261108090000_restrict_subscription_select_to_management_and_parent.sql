-- Restrict subscription visibility to management/accounting and each parent's own children.
-- This replaces the older receptionist-inclusive SELECT policy. It does not alter
-- subscription creation/update permissions or any existing financial records.

drop policy if exists select_subscriptions_authenticated on public.subscriptions;
drop policy if exists select_subscriptions_parent_own_children on public.subscriptions;

create policy select_subscriptions_management_or_parent on public.subscriptions
for select to authenticated
using (
  (select internal.has_role(array['manager','accountant']::text[]))
  or (
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

notify pgrst, 'reload schema';
