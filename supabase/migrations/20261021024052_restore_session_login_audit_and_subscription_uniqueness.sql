-- The same signed-in session is recorded once across password, OAuth and reload.
create or replace function internal.record_authenticated_login()
returns public.login_audit_logs language plpgsql security definer set search_path='' as $$
declare v_session text:=auth.jwt()->>'session_id'; v_details text; v_row public.login_audit_logs;
begin
 if auth.uid() is null or v_session is null then raise exception 'Authenticated session required' using errcode='42501'; end if;
 v_details:='Authenticated session: '||v_session;
 perform pg_advisory_xact_lock(hashtextextended('login:'||auth.uid()::text||':'||v_session,0));
 select * into v_row from public.login_audit_logs where action='login' and details=v_details limit 1;
 if found then return v_row; end if;
 return internal.record_client_login_audit('login',v_details);
end $$;
revoke all on function internal.record_authenticated_login() from public,anon;
grant execute on function internal.record_authenticated_login() to authenticated;
create or replace function public.record_login_audit_log(p_action text,p_details text)
returns public.login_audit_logs language plpgsql security invoker set search_path='' as $$
begin
 if p_action is distinct from 'login' then raise exception 'Unsupported client audit action' using errcode='22023'; end if;
 return internal.record_authenticated_login();
end $$;
revoke all on function public.record_login_audit_log(text,text) from public,anon;
grant execute on function public.record_login_audit_log(text,text) to authenticated;
-- Database protection is independent of UI checks and serializes concurrent inserts.
create unique index if not exists subscriptions_player_period_unique
 on public.subscriptions(player_id,start_date,end_date) where status<>'exempt';
notify pgrst,'reload schema';
