drop policy if exists ai_action_requests_deny_direct_access on public.ai_action_requests;
create policy ai_action_requests_deny_direct_access
on public.ai_action_requests
as restrictive
for all
to public
using (false)
with check (false);
