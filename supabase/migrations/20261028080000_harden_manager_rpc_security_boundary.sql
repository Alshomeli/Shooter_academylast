-- Security: keep privileged manager implementation outside exposed public schema.
-- Role authorization remains enforced inside each internal SECURITY DEFINER function.
begin;
alter function public.approve_registration_with_subscriptions(uuid,jsonb) set schema internal;
alter function public.archive_player_safely(text) set schema internal;
alter function public.issue_registration_subscription(uuid,text) set schema internal;
alter function public.manager_approve_parent_review(uuid,boolean) set schema internal;
alter function public.manager_review_parent_reviews() set schema internal;

create function public.approve_registration_with_subscriptions(p_application_id uuid,p_decisions jsonb)
returns jsonb language sql security invoker set search_path='' as
$$ select internal.approve_registration_with_subscriptions(p_application_id,p_decisions) $$;

create function public.archive_player_safely(p_player_id text)
returns jsonb language sql security invoker set search_path='' as
$$ select internal.archive_player_safely(p_player_id) $$;

create function public.issue_registration_subscription(p_child_id uuid,p_exemption_reason text default null)
returns text language sql security invoker set search_path='' as
$$ select internal.issue_registration_subscription(p_child_id,p_exemption_reason) $$;

create function public.manager_approve_parent_review(p_review_id uuid,p_approve boolean)
returns void language sql security invoker set search_path='' as
$$ select internal.manager_approve_parent_review(p_review_id,p_approve) $$;

create function public.manager_review_parent_reviews()
returns table(id uuid,display_name text,quote text,rating integer,created_at timestamptz)
language sql security invoker set search_path='' as
$$ select * from internal.manager_review_parent_reviews() $$;

revoke all on function public.approve_registration_with_subscriptions(uuid,jsonb),
 public.archive_player_safely(text),public.issue_registration_subscription(uuid,text),
 public.manager_approve_parent_review(uuid,boolean),public.manager_review_parent_reviews()
from public,anon,authenticated;
grant execute on function public.approve_registration_with_subscriptions(uuid,jsonb),
 public.archive_player_safely(text),public.issue_registration_subscription(uuid,text),
 public.manager_approve_parent_review(uuid,boolean),public.manager_review_parent_reviews()
to authenticated;
notify pgrst,'reload schema';
commit;
