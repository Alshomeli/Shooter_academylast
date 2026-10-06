-- Explicit RPC execute grants for authenticated workflow callers.

revoke all on function internal.add_registration_child(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function internal.delete_registration_child(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function internal.delete_registration_application(uuid)
  from public, anon, authenticated, service_role;
revoke all on function internal.delete_staff_member_safely(text, text)
  from public, anon, authenticated, service_role;
revoke all on function internal.delete_team_safely(text)
  from public, anon, authenticated, service_role;

grant execute on function internal.add_registration_child(uuid, jsonb) to authenticated;
grant execute on function internal.delete_registration_child(uuid, uuid) to authenticated;
grant execute on function internal.delete_registration_application(uuid) to authenticated;
grant execute on function internal.delete_staff_member_safely(text, text) to authenticated;
grant execute on function internal.delete_team_safely(text) to authenticated;

revoke all on function public.add_registration_child(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_registration_child(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_registration_application(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_staff_member_safely(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_team_safely(text)
  from public, anon, authenticated, service_role;

grant execute on function public.add_registration_child(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_registration_child(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.delete_registration_application(uuid)
  to authenticated, service_role;
grant execute on function public.delete_staff_member_safely(text, text)
  to authenticated, service_role;
grant execute on function public.delete_team_safely(text)
  to authenticated, service_role;
