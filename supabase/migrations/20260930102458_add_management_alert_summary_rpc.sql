create or replace function internal.management_alert_summary_impl()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_role text;
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_pending_proofs int := 0;
  v_expiring_staff_docs int := 0;
  v_expired_staff_docs int := 0;
  v_unpaid int := 0;
  v_due_amount numeric := 0;
begin
  select s.role into v_role from public.staff s
  where s.user_id=auth.uid() and s.status='active' limit 1;
  if v_role is null then raise exception 'active staff required'; end if;

  if v_role in ('manager','accountant') then
    select count(*) into v_pending_proofs from public.payment_proofs where status='pending';
    select count(*) into v_unpaid from public.subscriptions where status='unpaid';
    select coalesce(sum(amount),0) into v_due_amount from public.subscriptions where status='unpaid';
  end if;

  if v_role='manager' then
    select count(*) into v_expiring_staff_docs from public.staff_documents
      where document_type<>'profile_photo' and expiry_date between v_today and v_today+30;
    select count(*) into v_expired_staff_docs from public.staff_documents
      where document_type<>'profile_photo' and expiry_date < v_today;
  end if;

  return jsonb_build_object(
    'pendingPaymentProofs',v_pending_proofs,
    'expiringStaffDocuments',v_expiring_staff_docs,
    'expiredStaffDocuments',v_expired_staff_docs,
    'unpaidSubscriptions',v_unpaid,
    'dueAmount',v_due_amount,
    'asOf',v_today
  );
end $$;

create or replace function public.management_alert_summary()
returns jsonb language sql security invoker set search_path=''
as $$ select internal.management_alert_summary_impl(); $$;

revoke all on function internal.management_alert_summary_impl() from public,anon;
grant execute on function internal.management_alert_summary_impl() to authenticated;
revoke all on function public.management_alert_summary() from public,anon;
grant execute on function public.management_alert_summary() to authenticated;
