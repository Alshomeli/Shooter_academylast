create or replace function internal.approve_staff_application_as_staff(p_application_id uuid,p_reviewer_staff_id text)
returns public.staff_applications language plpgsql security definer set search_path='' as $$
declare v_row public.staff_applications; v_staff_id text;
begin
 if not exists(select 1 from public.staff where id=p_reviewer_staff_id and role='manager' and status='active') then
  raise exception 'Active manager reviewer required' using errcode='42501';
 end if;
 select * into v_row from public.staff_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if v_row.status<>'pending' then raise exception 'Only pending applications can be approved'; end if;
 if exists(select 1 from public.staff where user_id=v_row.applicant_user_id) then raise exception 'Staff account already exists'; end if;
 if exists(select 1 from public.staff where lower(email)=lower(v_row.email)) then raise exception 'Staff email already exists'; end if;
 v_staff_id:='staff-'||gen_random_uuid()::text;
 insert into public.staff(id,user_id,name,email,phone,role,salary,specialization,status,joined_date,avatar_url,national_id,licenses,experience_years,rating,tactical_style,notes)
 values(v_staff_id,v_row.applicant_user_id,v_row.full_name,v_row.email,v_row.phone,v_row.requested_role,0,
  coalesce(v_row.specialization,''),'active',current_date,'',v_row.national_id,v_row.licenses,v_row.experience_years,null,null,v_row.applicant_notes);
 update public.staff_applications set status='approved',reviewed_at=now(),reviewed_by_staff_id=p_reviewer_staff_id,
  approved_staff_id=v_staff_id,updated_at=now() where id=v_row.id returning * into v_row;
 return v_row;
end $$;
revoke all on function internal.approve_staff_application_as_staff(uuid,text) from public,anon,authenticated;

create or replace function internal.approve_staff_application(p_application_id uuid)
returns public.staff_applications language plpgsql security definer set search_path='' as $$
declare v_manager_id text;
begin
 if not (select internal.is_academy_admin()) then raise exception 'Manager authorization required' using errcode='42501'; end if;
 select id into v_manager_id from public.staff where user_id=(select auth.uid()) and role='manager' and status='active' limit 1;
 if v_manager_id is null then raise exception 'Active manager profile required' using errcode='42501'; end if;
 return internal.approve_staff_application_as_staff(p_application_id,v_manager_id);
end $$;
revoke all on function internal.approve_staff_application(uuid) from public,anon,authenticated;

create or replace function internal.telegram_approve_staff_application(p_application_id uuid,p_chat_id_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_manager public.staff%rowtype; v_row public.staff_applications; v_status text; v_reviewer text;
begin
 select s.* into v_manager from internal.telegram_manager_bindings b join public.staff s on s.id=b.staff_id
 where b.chat_id_hash=p_chat_id_hash and b.active=true and s.role='manager' and s.status='active';
 if not found then raise exception 'Telegram manager binding not authorized' using errcode='42501'; end if;
 select status,reviewed_by_staff_id into v_status,v_reviewer from public.staff_applications where id=p_application_id for update;
 if not found then raise exception 'Application not found'; end if;
 if v_status<>'pending' then
  return jsonb_build_object('success',false,'alreadyProcessed',true,'applicationId',p_application_id,'status',v_status,'reviewedByStaffId',v_reviewer);
 end if;
 v_row:=internal.approve_staff_application_as_staff(p_application_id,v_manager.id);
 insert into internal.telegram_admin_actions(chat_id_hash,staff_id,action,entity_type,entity_id)
 values(p_chat_id_hash,v_manager.id,'approve','staff_application',p_application_id);
 return jsonb_build_object('success',true,'applicationId',p_application_id,'status',v_row.status,'approvedStaffId',v_row.approved_staff_id,
  'requestedRole',v_row.requested_role,'reviewedByStaffId',v_manager.id,'reviewedByName',trim(v_manager.name));
end $$;
revoke all on function internal.telegram_approve_staff_application(uuid,text) from public,anon,authenticated;

create or replace function public.telegram_approve_staff_application(p_application_id uuid,p_chat_id_hash text)
returns jsonb language sql security definer set search_path='' as $$select internal.telegram_approve_staff_application($1,$2)$$;
revoke all on function public.telegram_approve_staff_application(uuid,text) from public,anon,authenticated;
grant execute on function public.telegram_approve_staff_application(uuid,text) to service_role;
