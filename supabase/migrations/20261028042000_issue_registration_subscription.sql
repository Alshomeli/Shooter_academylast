-- Manager-only issuance after approved registration. Never records a payment.
create or replace function public.issue_registration_subscription(p_child_id uuid, p_exemption_reason text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_staff text; v_child public.registration_children%rowtype; v_app public.registration_applications%rowtype;
 v_fee numeric(12,3); v_sub_id text; v_today date := (now() at time zone 'Asia/Bahrain')::date;
 v_existing public.subscriptions%rowtype; v_parent_user uuid;
begin
 select id into v_staff from public.staff where user_id=auth.uid() and role='manager' and status='active' limit 1;
 if v_staff is null then raise exception 'Active manager required' using errcode='42501'; end if;
 select * into v_child from public.registration_children where id=p_child_id for update;
 if not found or v_child.approved_player_id is null then raise exception 'Approved child required'; end if;
 select * into v_app from public.registration_applications where id=v_child.application_id for update;
 if v_app.status<>'approved' then raise exception 'Registration approval required'; end if;
 select monthly_amount into v_fee from public.registration_child_fees where child_id=p_child_id;
 if v_fee is null then raise exception 'Manager must save fee decision first'; end if;
 if v_fee<0 or v_fee>25 or v_fee<>round(v_fee,3) then raise exception 'Invalid monthly fee'; end if;
 if v_fee=0 and (p_exemption_reason is null or length(trim(p_exemption_reason)) not between 3 and 1000)
 then raise exception 'Exemption reason required'; end if;
 perform 1 from public.players where id=v_child.approved_player_id for update;
 select * into v_existing from public.subscriptions
 where player_id=v_child.approved_player_id and status<>'cancelled'
   and start_date<=v_today and end_date>v_today for update;
 if found then
   if v_existing.start_date=v_today and v_existing.end_date=(v_today+interval '1 month')::date
     and v_existing.amount=v_fee and v_existing.status=(case when v_fee=0 then 'exempt' else 'unpaid' end)
   then return v_existing.id; end if;
   raise exception 'An overlapping subscription already exists';
 end if;
 v_sub_id:='sub-registration-'||p_child_id::text;
 insert into public.subscriptions(id,player_id,plan_type,amount,start_date,end_date,status,payment_method,paid_at,exemption_reason)
 values(v_sub_id,v_child.approved_player_id,'monthly',v_fee,v_today,(v_today+interval '1 month')::date,
    case when v_fee=0 then 'exempt' else 'unpaid' end,null,null,
    case when v_fee=0 then trim(p_exemption_reason) else null end);
 if v_fee=0 then
    update public.players set status='active' where id=v_child.approved_player_id and status='inactive';
 end if;
 v_parent_user:=v_app.applicant_user_id;
 if v_parent_user is not null then
  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  values('notif-fee-'||p_child_id::text,
    case when v_fee=0 then 'إعفاء من رسوم الاشتراك' else 'طلب دفع اشتراك اللاعب' end,
    case when v_fee=0 then 'تم إعفاء اللاعب '||v_child.full_name||' من رسوم الاشتراك للفترة الحالية.'
    else 'تم اعتماد رسوم اللاعب '||v_child.full_name||' بقيمة '||v_fee::text||' د.ب. افتح صفحة الاشتراكات لنسخ بيانات بنفت ورفع إثبات الدفع.' end,
    now()::text,'subscription',false,v_parent_user)
  on conflict(id) do nothing;
 end if;
 insert into public.audit_logs(id,action,timestamp,user_role,user_name,details)
 values('audit-'||gen_random_uuid()::text,'registration_subscription_issued',now()::text,'manager',
 (select name from public.staff where id=v_staff),
 pg_catalog.jsonb_build_object('child_id',p_child_id,'subscription_id',v_sub_id,'amount',v_fee,'exempt',v_fee=0)::text);
 return v_sub_id;
end $$;
revoke all on function public.issue_registration_subscription(uuid,text) from public,anon;
grant execute on function public.issue_registration_subscription(uuid,text) to authenticated;
notify pgrst,'reload schema';
