-- Historical synchronization of the production registration approval execute fix.
-- Production already has this state. This migration makes fresh environments
-- reproduce the same least-privilege RPC chain.

create or replace function public.approve_registration_application(p_application_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal.approve_registration_application(p_application_id)
$$;

revoke all on function public.approve_registration_application(uuid) from public, anon;
grant execute on function public.approve_registration_application(uuid) to authenticated;

revoke all on function internal.approve_registration_application(uuid) from public, anon;
grant execute on function internal.approve_registration_application(uuid) to authenticated;
