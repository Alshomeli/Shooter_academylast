-- Force staff/team deletion through the reviewed safe RPC workflows.
-- The RPC implementations perform manager authorization and relationship checks.
-- Removing direct table DELETE prevents authenticated clients from bypassing them.

revoke delete on table public.staff from authenticated;
revoke delete on table public.teams from authenticated;

-- Keep only the public wrappers callable from authenticated clients.
revoke all on function internal.delete_staff_member_safely(text,text) from public, anon, authenticated;
revoke all on function internal.delete_team_safely(text) from public, anon, authenticated;

revoke all on function public.delete_staff_member_safely(text,text) from public, anon;
revoke all on function public.delete_team_safely(text) from public, anon;
grant execute on function public.delete_staff_member_safely(text,text) to authenticated;
grant execute on function public.delete_team_safely(text) to authenticated;
