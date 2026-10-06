drop policy if exists select_parents_authenticated on public.parents;
create policy select_parents_authenticated on public.parents
for select to authenticated
using (
  internal.has_role(array['manager','receptionist'])
  or (internal.has_role(array['coach']) and internal.is_coach_of_parent(id))
  or (internal.has_role(array['parent']) and user_id=(select auth.uid()))
);
