create or replace function internal.notify_staff_application_transition()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_role_label text;
begin
  v_role_label := case new.requested_role
    when 'coach' then 'مدرب'
    when 'accountant' then 'محاسب'
    when 'receptionist' then 'استقبال'
    else new.requested_role end;

  if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    select 'notif-'||gen_random_uuid()::text,
           'طلب انضمام موظف / مدرب جديد',
           'تم إرسال طلب انضمام جديد بصفة '||v_role_label||' من '||new.full_name||'.',
           now()::text,'staff_application',false,s.user_id
    from public.staff s
    where s.role='manager' and s.status='active' and s.user_id is not null;
  end if;

  if tg_op='UPDATE' and old.status is distinct from new.status then
    if new.status='approved' then
      insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
      values('notif-'||gen_random_uuid()::text,'تم قبول طلب الانضمام',
        'تم اعتماد طلبك وتفعيل حسابك بصلاحية '||v_role_label||'.',
        now()::text,'staff_application',false,new.applicant_user_id);
    elsif new.status='needs_info' then
      insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
      values('notif-'||gen_random_uuid()::text,'طلب الانضمام يحتاج تعديل',
        coalesce(nullif(trim(new.review_notes),''),'يرجى مراجعة طلبك واستكمال البيانات المطلوبة.'),
        now()::text,'staff_application',false,new.applicant_user_id);
    elsif new.status='rejected' then
      insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
      values('notif-'||gen_random_uuid()::text,'تحديث طلب الانضمام',
        coalesce(nullif(trim(new.review_notes),''),'تم تحديث حالة طلب الانضمام.'),
        now()::text,'staff_application',false,new.applicant_user_id);
    end if;
  end if;
  return new;
end $$;
revoke all on function internal.notify_staff_application_transition() from public,anon,authenticated;

drop trigger if exists trg_notify_staff_application_transition on public.staff_applications;
create trigger trg_notify_staff_application_transition
after insert or update of status on public.staff_applications
for each row execute function internal.notify_staff_application_transition();

create index if not exists staff_applications_approved_staff_id_idx
  on public.staff_applications(approved_staff_id) where approved_staff_id is not null;
create index if not exists staff_applications_reviewed_by_staff_id_idx
  on public.staff_applications(reviewed_by_staff_id) where reviewed_by_staff_id is not null;
