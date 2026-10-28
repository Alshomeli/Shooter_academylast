-- Single transaction: manager's registration approval and each child's payment/exemption decision.
create or replace function public.approve_registration_with_subscriptions(p_application_id uuid,p_decisions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_staff text; v_app public.registration_applications%rowtype;
  v_child record; v_decision jsonb; v_fee numeric(12,3); v_reason text;
  v_result jsonb; v_issued jsonb := '[]'::jsonb; v_subscription text;
begin
  select id into v_staff from public.staff
    where user_id=auth.uid() and role='manager' and status='active' limit 1;
  if v_staff is null then raise exception 'Active manager required' using errcode='42501'; end if;
  if p_decisions is null or jsonb_typeof(p_decisions)<>'object' then
    raise exception 'Player decisions must be an object'; end if;
  select * into v_app from public.registration_applications where id=p_application_id for update;
  if not found or v_app.status not in ('pending','under_review') then
    raise exception 'Registration is not awaiting approval'; end if;
  if (select count(*) from public.registration_children where application_id=p_application_id)=0 then
    raise exception 'Registration has no children'; end if;
  if (select count(*) from jsonb_object_keys(p_decisions)) <>
     (select count(*) from public.registration_children where application_id=p_application_id)
  then raise exception 'Every child must have exactly one decision'; end if;
  for v_child in select id from public.registration_children where application_id=p_application_id order by id loop
    v_decision:=p_decisions -> (v_child.id::text);
    if v_decision is null or jsonb_typeof(v_decision)<>'object' then
      raise exception 'Missing decision for child %',v_child.id; end if;
    if jsonb_typeof(v_decision->'amount') <> 'number' then
      raise exception 'Numeric fee required for child %',v_child.id; end if;
    v_fee:=(v_decision->>'amount')::numeric;
    v_reason:=nullif(trim(coalesce(v_decision->>'reason','')),'');
    if v_fee<0 or v_fee>25 or v_fee<>round(v_fee,3) then
      raise exception 'Invalid fee for child %',v_child.id; end if;
    if v_fee=0 and (v_reason is null or length(v_reason) not between 3 and 1000) then
      raise exception 'Exemption reason required for child %',v_child.id; end if;
    insert into public.registration_child_fees(child_id,monthly_amount,updated_by,updated_at)
      values(v_child.id,v_fee,auth.uid(),now())
      on conflict(child_id) do update set monthly_amount=excluded.monthly_amount,
        updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end loop;
  v_result:=public.approve_registration_application(p_application_id);
  if (select status from public.registration_applications where id=p_application_id)<>'approved' then
    raise exception 'Registration approval did not complete'; end if;
  for v_child in select id from public.registration_children where application_id=p_application_id order by id loop
    v_decision:=p_decisions -> (v_child.id::text);
    v_fee:=(v_decision->>'amount')::numeric;
    v_reason:=case when v_fee=0 then trim(v_decision->>'reason') else null end;
    v_subscription:=public.issue_registration_subscription(v_child.id,v_reason);
    v_issued:=v_issued || jsonb_build_array(jsonb_build_object(
       'childId',v_child.id,'subscriptionId',v_subscription,
       'amount',v_fee,'status',case when v_fee=0 then 'exempt' else 'unpaid' end));
  end loop;
  return jsonb_build_object('success',true,'applicationId',p_application_id,
       'subscriptions',v_issued,'approval',v_result);
end $$;
revoke all on function public.approve_registration_with_subscriptions(uuid,jsonb) from public,anon;
grant execute on function public.approve_registration_with_subscriptions(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
