-- Safe on projects already hardened: production migration was executed independently.
do $migration$
begin
  if to_regprocedure('internal.approve_registration_with_subscriptions(uuid,jsonb)') is not null
     and exists (select 1 from pg_proc where oid='public.approve_registration_with_subscriptions(uuid,jsonb)'::regprocedure and not prosecdef)
  then
    raise notice 'Manager RPC security boundary already installed';
  else
    execute $cmd0$alter function public.approve_registration_with_subscriptions(uuid,jsonb) set schema internal$cmd0$;
    execute $cmd1$alter function public.archive_player_safely(text) set schema internal$cmd1$;
    execute $cmd2$alter function public.issue_registration_subscription(uuid,text) set schema internal$cmd2$;
    execute $cmd3$alter function public.manager_approve_parent_review(uuid,boolean) set schema internal$cmd3$;
    execute $cmd4$alter function public.manager_review_parent_reviews() set schema internal$cmd4$;
    execute $cmd5$create function public.approve_registration_with_subscriptions(p_application_id uuid,p_decisions jsonb)
returns jsonb language sql security invoker set search_path='' as
$$ select internal.approve_registration_with_subscriptions(p_application_id,p_decisions) $$$cmd5$;
    execute $cmd6$create function public.archive_player_safely(p_player_id text)
returns jsonb language sql security invoker set search_path='' as
$$ select internal.archive_player_safely(p_player_id) $$$cmd6$;
    execute $cmd7$create function public.issue_registration_subscription(p_child_id uuid,p_exemption_reason text default null)
returns text language sql security invoker set search_path='' as
$$ select internal.issue_registration_subscription(p_child_id,p_exemption_reason) $$$cmd7$;
    execute $cmd8$create function public.manager_approve_parent_review(p_review_id uuid,p_approve boolean)
returns void language sql security invoker set search_path='' as
$$ select internal.manager_approve_parent_review(p_review_id,p_approve) $$$cmd8$;
    execute $cmd9$create function public.manager_review_parent_reviews()
returns table(id uuid,display_name text,quote text,rating integer,created_at timestamptz)
language sql security invoker set search_path='' as
$$ select * from internal.manager_review_parent_reviews() $$$cmd9$;
    execute $cmd10$revoke all on function public.approve_registration_with_subscriptions(uuid,jsonb),
 public.archive_player_safely(text),public.issue_registration_subscription(uuid,text),
 public.manager_approve_parent_review(uuid,boolean),public.manager_review_parent_reviews()
from public,anon,authenticated$cmd10$;
    execute $cmd11$grant execute on function public.approve_registration_with_subscriptions(uuid,jsonb),
 public.archive_player_safely(text),public.issue_registration_subscription(uuid,text),
 public.manager_approve_parent_review(uuid,boolean),public.manager_review_parent_reviews()
to authenticated$cmd11$;
    execute $cmd12$notify pgrst,'reload schema'$cmd12$;
  end if;
end;
$migration$;
