create or replace function internal.notify_managers_payment_proof_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager record;
  v_notification_id text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending' then
    return new;
  end if;

  for v_manager in
    select s.user_id
    from public.staff s
    where s.role = 'manager'
      and s.status = 'active'
      and s.user_id is not null
  loop
    v_notification_id :=
      'notif-proof-review-' || new.id::text || '-' || new.row_version::text || '-' || v_manager.user_id::text;

    insert into public.notifications(
      id, title, message, timestamp, type, read, recipient_user_id
    )
    values(
      v_notification_id,
      'إثبات دفع بانتظار المراجعة',
      case when tg_op = 'INSERT'
        then 'رفع ولي أمر إثبات تحويل Benefit جديد. راجعه من شاشة الاشتراكات.'
        else 'أعاد ولي الأمر إرسال إثبات تحويل Benefit بعد طلب الاستكمال. راجعه من شاشة الاشتراكات.'
      end,
      to_char(now() at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
      'warning',
      false,
      v_manager.user_id
    )
    on conflict (id) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function internal.notify_managers_payment_proof_pending() from public, anon, authenticated;

drop trigger if exists trg_notify_managers_payment_proof_pending on public.payment_proofs;
create trigger trg_notify_managers_payment_proof_pending
after insert or update of status on public.payment_proofs
for each row
execute function internal.notify_managers_payment_proof_pending();
