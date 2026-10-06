create or replace function internal.review_staff_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.staff_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  v_staff_id text;
  v_row public.staff_applications;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if p_status not in ('needs_info','rejected') then
    raise exception 'Invalid review status';
  end if;

  select id into v_staff_id
  from public.staff
  where user_id=(select auth.uid()) and role='manager' and status='active'
  limit 1;

  select * into v_row
  from public.staff_applications
  where id=p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending applications can be reviewed'; end if;

  update public.staff_applications
  set status=p_status,
      review_notes=nullif(trim(coalesce(p_notes,'')), ''),
      reviewed_at=now(),
      reviewed_by_staff_id=v_staff_id,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.review_staff_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.staff_applications
language sql
set search_path=''
as $$
  select internal.review_staff_application($1,$2,$3);
$$;

revoke all on function internal.review_staff_application(uuid,text,text) from public, anon;
revoke all on function public.review_staff_application(uuid,text,text) from public, anon;
grant execute on function public.review_staff_application(uuid,text,text) to authenticated;
