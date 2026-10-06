create or replace function internal.approve_registration_application_as_staff(p_application_id uuid,p_reviewer_staff_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_app public.registration_applications%rowtype; v_child public.registration_children%rowtype;
 v_parent_id text; v_existing_parent_user_id uuid; v_player_id text; v_players jsonb:='[]'::jsonb; v_existing_player_id text;
begin
 if not exists(select 1 from public.staff s where s.id=p_reviewer_staff_id and s.role='manager' and s.status='active') then
  raise exception 'Active manager reviewer required' using errcode='42501';
 end if;
 select * into v_app from public.registration_applications where id=p_application_id for update;
 if not found then raise exception 'Registration application not found'; end if;
 if v_app.status not in ('pending','under_review') then raise exception 'Only submitted applications can be approved'; end if;
 if nullif(trim(v_app.parent_full_name),'') is null or nullif(trim(v_app.parent_national_id),'') is null
 or nullif(trim(v_app.parent_phone),'') is null or nullif(trim(v_app.parent_email),'') is null then raise exception 'Parent required information is incomplete'; end if;
 if not exists(select 1 from public.registration_children where application_id=p_application_id) then raise exception 'At least one child is required'; end if;
 if exists(select 1 from public.registration_children c where c.application_id=p_application_id and not exists(
  select 1 from public.registration_documents d where d.child_id=c.id and d.file_category='photo'
 )) then raise exception 'Every child must have a profile photo before approval'; end if;

 select pp.id into v_parent_id from public.get_parent_private() pp
 where lower(trim(pp.national_id))=lower(trim(v_app.parent_national_id)) limit 1;
 if v_parent_id is null then
  v_parent_id:='parent-'||gen_random_uuid()::text;
  insert into public.parents(id,name,national_id,nationality,phone,whatsapp_phone,email,address,occupation,workplace,status,notes,joined_date,user_id)
  values(v_parent_id,trim(v_app.parent_full_name),trim(v_app.parent_national_id),coalesce(trim(v_app.parent_nationality),''),
   trim(v_app.parent_phone),coalesce(nullif(trim(coalesce(v_app.parent_whatsapp,'')),''),trim(v_app.parent_phone)),
   lower(trim(v_app.parent_email)),coalesce(trim(v_app.parent_address),''),coalesce(trim(v_app.parent_occupation),''),
   coalesce(trim(v_app.parent_workplace),''),'active',coalesce(v_app.parent_notes,''),current_date,v_app.applicant_user_id);
 else
  select user_id into v_existing_parent_user_id from public.parents where id=v_parent_id;
  if v_app.applicant_user_id is not null and v_existing_parent_user_id is not null and v_existing_parent_user_id<>v_app.applicant_user_id then
   raise exception 'Existing parent CPR is linked to another login account';
  end if;
  update public.parents set name=trim(v_app.parent_full_name),phone=trim(v_app.parent_phone),
   whatsapp_phone=coalesce(nullif(trim(coalesce(v_app.parent_whatsapp,'')),''),trim(v_app.parent_phone)),
   email=lower(trim(v_app.parent_email)),nationality=coalesce(trim(v_app.parent_nationality),nationality),
   address=coalesce(trim(v_app.parent_address),address),occupation=coalesce(trim(v_app.parent_occupation),occupation),
   workplace=coalesce(trim(v_app.parent_workplace),workplace),notes=coalesce(v_app.parent_notes,notes),
   user_id=coalesce(user_id,v_app.applicant_user_id) where id=v_parent_id;
 end if;

 for v_child in select * from public.registration_children where application_id=p_application_id order by created_at,id loop
  if nullif(trim(v_child.national_id),'') is null then raise exception 'Child CPR is required'; end if;
  select pi.id into v_existing_player_id from public.get_player_identity_private() pi
   where lower(trim(pi.national_id))=lower(trim(v_child.national_id)) limit 1;
  if v_existing_player_id is not null then raise exception 'A player with this CPR already exists'; end if;
  v_player_id:='player-'||gen_random_uuid()::text;
  insert into public.players(id,name,national_id,birth_date,blood_type,jersey_number,position,team_id,parent_name,parent_phone,parent_email,parent_id,status,notes,joined_date)
  values(v_player_id,trim(v_child.full_name),trim(v_child.national_id),v_child.birth_date,coalesce(trim(v_child.blood_type),''),
   0,'',null,trim(v_app.parent_full_name),trim(v_app.parent_phone),lower(trim(v_app.parent_email)),v_parent_id,'inactive',coalesce(v_child.parent_notes,''),current_date);
  update public.registration_children set approved_player_id=v_player_id where id=v_child.id;
  update public.registration_documents set approved_player_id=v_player_id where child_id=v_child.id;
  v_players:=v_players||jsonb_build_array(jsonb_build_object('childId',v_child.id,'playerId',v_player_id));
 end loop;

 update public.registration_applications set status='approved',reviewed_at=now(),reviewed_by_staff_id=p_reviewer_staff_id,
 approved_parent_id=v_parent_id,updated_at=now() where id=p_application_id;
 if v_app.applicant_user_id is not null then
  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  values('notif-'||gen_random_uuid()::text,'تمت الموافقة على طلب التسجيل',
   'تمت الموافقة على طلب التسجيل وسيتم استكمال التوزيع الداخلي من إدارة الأكاديمية.',
   now()::text,'registration',false,v_app.applicant_user_id);
 end if;
 return jsonb_build_object('success',true,'applicationId',p_application_id,'parentId',v_parent_id,'players',v_players,'nextStep','assign_birth_category_then_activate');
end $$;
revoke all on function internal.approve_registration_application_as_staff(uuid,text) from public,anon,authenticated;

create or replace function internal.approve_registration_application(p_application_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff_id text;
begin
 if (select internal.is_academy_admin()) is not true then raise exception 'Manager authorization required' using errcode='42501'; end if;
 select id into v_staff_id from public.staff where user_id=(select auth.uid()) and role='manager' and status='active' limit 1;
 if v_staff_id is null then raise exception 'Active manager profile required' using errcode='42501'; end if;
 return internal.approve_registration_application_as_staff(p_application_id,v_staff_id);
end $$;
revoke all on function internal.approve_registration_application(uuid) from public,anon,authenticated;

create or replace function internal.telegram_approve_registration_application(p_application_id uuid,p_chat_id_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff public.staff%rowtype; v_result jsonb; v_status text; v_reviewer text;
begin
 select s.* into v_staff from internal.telegram_manager_bindings b join public.staff s on s.id=b.staff_id
 where b.chat_id_hash=p_chat_id_hash and b.active=true and s.role='manager' and s.status='active';
 if not found then raise exception 'Telegram manager binding not authorized' using errcode='42501'; end if;
 select status,reviewed_by_staff_id into v_status,v_reviewer from public.registration_applications where id=p_application_id for update;
 if not found then raise exception 'Registration application not found'; end if;
 if v_status not in ('pending','under_review') then
  return jsonb_build_object('success',false,'alreadyProcessed',true,'applicationId',p_application_id,'status',v_status,'reviewedByStaffId',v_reviewer);
 end if;
 v_result:=internal.approve_registration_application_as_staff(p_application_id,v_staff.id);
 insert into internal.telegram_admin_actions(chat_id_hash,staff_id,action,entity_type,entity_id)
 values(p_chat_id_hash,v_staff.id,'approve','registration_application',p_application_id);
 return v_result||jsonb_build_object('reviewedByStaffId',v_staff.id,'reviewedByName',trim(v_staff.name));
end $$;
revoke all on function internal.telegram_approve_registration_application(uuid,text) from public,anon,authenticated;
