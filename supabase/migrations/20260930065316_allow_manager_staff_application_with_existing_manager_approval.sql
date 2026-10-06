alter table public.staff_applications drop constraint if exists staff_applications_requested_role_check;
alter table public.staff_applications add constraint staff_applications_requested_role_check
  check (requested_role in ('manager','coach','accountant','receptionist'));

create or replace function internal.create_or_update_staff_application(
 p_requested_role text,p_full_name text,p_phone text,p_national_id text default null,
 p_specialization text default null,p_experience_years integer default null,
 p_licenses text[] default '{}',p_applicant_notes text default null
) returns public.staff_applications language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_email text; v_row public.staff_applications;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_requested_role not in ('manager','coach','accountant','receptionist') then raise exception 'Invalid requested role'; end if;
 select lower(trim(email)) into v_email from auth.users where id=v_uid;
 if v_email is null then raise exception 'Authenticated email required'; end if;
 if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'Full name required'; end if;
 if nullif(trim(coalesce(p_phone,'')),'') is null then raise exception 'Phone required'; end if;
 if p_experience_years is not null and p_experience_years<0 then raise exception 'Invalid experience years'; end if;
 if exists(select 1 from public.staff where user_id=v_uid) then raise exception 'Staff account already exists'; end if;
 select * into v_row from public.staff_applications
 where applicant_user_id=v_uid and status in ('draft','needs_info')
 order by created_at desc limit 1 for update;
 if found then
  update public.staff_applications set requested_role=p_requested_role,full_name=trim(p_full_name),email=v_email,phone=trim(p_phone),
   national_id=nullif(trim(coalesce(p_national_id,'')),''),
   specialization=nullif(trim(coalesce(p_specialization,'')),''),
   experience_years=p_experience_years,licenses=coalesce(p_licenses,'{}'),
   applicant_notes=nullif(trim(coalesce(p_applicant_notes,'')),''),
   status='draft',review_notes=null,reviewed_at=null,reviewed_by_staff_id=null,updated_at=now()
  where id=v_row.id returning * into v_row;
 else
  insert into public.staff_applications(applicant_user_id,requested_role,full_name,email,phone,national_id,specialization,experience_years,licenses,applicant_notes)
  values(v_uid,p_requested_role,trim(p_full_name),v_email,trim(p_phone),nullif(trim(coalesce(p_national_id,'')),''),
   nullif(trim(coalesce(p_specialization,'')),''),p_experience_years,coalesce(p_licenses,'{}'),nullif(trim(coalesce(p_applicant_notes,'')),''))
  returning * into v_row;
 end if;
 return v_row;
end $$;
revoke all on function internal.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) from public,anon,authenticated;
revoke all on function public.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) from public,anon;
grant execute on function public.create_or_update_staff_application(text,text,text,text,text,integer,text[],text) to authenticated;

create or replace function internal.notify_staff_application_transition()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_role_label text;
begin
 v_role_label:=case new.requested_role when 'manager' then 'مدير' when 'coach' then 'مدرب' when 'accountant' then 'محاسب' when 'receptionist' then 'استقبال' else new.requested_role end;
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  select 'notif-'||gen_random_uuid()::text,'طلب انضمام موظف / مدرب جديد','تم إرسال طلب انضمام جديد بصفة '||v_role_label||' من '||new.full_name||'.',now()::text,'staff_application',false,s.user_id
  from public.staff s where s.role='manager' and s.status='active' and s.user_id is not null;
 end if;
 if tg_op='UPDATE' and old.status is distinct from new.status then
  if new.status='approved' then
   insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
   values('notif-'||gen_random_uuid()::text,'تم قبول طلب الانضمام','تم اعتماد طلبك وتفعيل حسابك بصلاحية '||v_role_label||'.',now()::text,'staff_application',false,new.applicant_user_id);
  elsif new.status='needs_info' then
   insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
   values('notif-'||gen_random_uuid()::text,'طلب الانضمام يحتاج تعديل',coalesce(nullif(trim(new.review_notes),''),'يرجى استكمال البيانات المطلوبة.'),now()::text,'staff_application',false,new.applicant_user_id);
  elsif new.status='rejected' then
   insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
   values('notif-'||gen_random_uuid()::text,'تحديث طلب الانضمام',coalesce(nullif(trim(new.review_notes),''),'تم تحديث حالة طلب الانضمام.'),now()::text,'staff_application',false,new.applicant_user_id);
  end if;
 end if;
 return new;
end $$;
revoke all on function internal.notify_staff_application_transition() from public,anon,authenticated;
