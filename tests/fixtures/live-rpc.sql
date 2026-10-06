-- Definitions from the linked project; no user data.
CREATE OR REPLACE FUNCTION internal.get_parent_private()
 RETURNS TABLE(id text, national_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.national_id
  from public.parents p
  where (select internal.is_academy_admin())
$function$;

CREATE OR REPLACE FUNCTION internal.get_player_identity_private()
 RETURNS TABLE(id text, national_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.national_id
  from public.players p
  where (select internal.is_academy_admin())
$function$;

CREATE OR REPLACE FUNCTION internal.notify_managers_new_registration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into public.notifications (
      id, title, message, timestamp, type, read, recipient_user_id
    )
    select
      'notif-' || gen_random_uuid()::text,
      'طلب تسجيل جديد',
      'تم استلام طلب تسجيل جديد من ولي الأمر: ' || new.parent_full_name,
      now()::text,
      'registration',
      false,
      s.user_id
    from public.staff s
    where s.role = 'manager'
      and s.status = 'active'
      and s.user_id is not null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION internal.submit_registration_application(p_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_app public.registration_applications%rowtype;
  v_child_count int;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select * into v_app
  from public.registration_applications a
  where a.id=p_application_id and a.applicant_user_id=v_uid
  for update;
  if not found then raise exception 'Registration application not found or access denied' using errcode='42501'; end if;
  if v_app.status not in ('draft','needs_info') then raise exception 'Registration application cannot be submitted from its current status'; end if;

  select count(*) into v_child_count from public.registration_children c where c.application_id=p_application_id;
  if v_child_count < 1 then raise exception 'At least one child is required'; end if;

  if exists (
    select 1 from public.registration_children c
    where c.application_id=p_application_id
      and not exists (
        select 1 from public.registration_documents d
        where d.child_id=c.id and d.file_category='photo'
      )
  ) then raise exception 'Every child must have a profile photo before submission'; end if;

  update public.registration_applications
  set status='pending', submitted_at=now(), updated_at=now(), review_notes=null
  where id=p_application_id;

  return jsonb_build_object('success',true,'applicationId',p_application_id,'status','pending','childrenCount',v_child_count);
end;
$function$;

CREATE OR REPLACE FUNCTION internal.validate_subscription_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'paid' THEN
    IF NEW.paid_at IS NULL OR NULLIF(trim(COALESCE(NEW.payment_method, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Paid subscription requires paid_at and payment_method';
    END IF;
  ELSIF NEW.status = 'unpaid' THEN
    IF NEW.paid_at IS NOT NULL OR NULLIF(trim(COALESCE(NEW.payment_method, '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Unpaid subscription cannot contain payment metadata';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_parent_private()
 RETURNS TABLE(id text, national_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from internal.get_parent_private()
$function$;

CREATE OR REPLACE FUNCTION public.get_player_identity_private()
 RETURNS TABLE(id text, national_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from internal.get_player_identity_private()
$function$;

CREATE OR REPLACE FUNCTION public.review_registration_application(p_application_id uuid, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS registration_applications
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_row public.registration_applications%rowtype;
  v_staff_id text;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode = '42501';
  end if;

  if p_status not in ('under_review','needs_info','rejected') then
    raise exception 'Invalid review status';
  end if;

  select s.id into v_staff_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.role = 'manager'
    and s.status = 'active'
  limit 1;

  select * into v_row
  from public.registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Registration application not found';
  end if;
  if v_row.status in ('approved','rejected') then
    raise exception 'Registration application is already finalized';
  end if;

  update public.registration_applications
  set status = p_status,
      review_notes = nullif(trim(coalesce(p_notes,'')),''),
      reviewed_at = now(),
      reviewed_by_staff_id = v_staff_id,
      updated_at = now()
  where id = p_application_id
  returning * into v_row;

  if v_row.applicant_user_id is not null then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values (
      'notif-' || gen_random_uuid()::text,
      case p_status when 'needs_info' then 'طلب التسجيل يحتاج استكمال' when 'rejected' then 'تم تحديث طلب التسجيل' else 'طلب التسجيل قيد المراجعة' end,
      case p_status when 'needs_info' then 'يرجى مراجعة طلب التسجيل واستكمال البيانات المطلوبة.' when 'rejected' then 'تم رفض طلب التسجيل. يمكنك التواصل مع الأكاديمية لمزيد من التفاصيل.' else 'طلب التسجيل قيد المراجعة من الإدارة.' end,
      now()::text,
      'registration', false, v_row.applicant_user_id
    );
  end if;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_registration_application(p_application_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select internal.submit_registration_application(p_application_id)
$function$;
