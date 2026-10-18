-- Staging only: mirror explicit registration discounts to persistent player fees.
-- Missing overrides default to 25 BHD via getRenewalPrices; no historic billing changes.
create or replace function public.mirror_approved_child_fee()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_player_id text;
  v_amount numeric(9,3);
  v_updated_by uuid;
begin
  if tg_table_name='registration_children' then
    v_player_id := new.approved_player_id;
    if v_player_id is null then return new; end if;
    select f.monthly_amount,f.updated_by into v_amount,v_updated_by
      from public.registration_child_fees f where f.child_id=new.id;
  elsif tg_table_name='registration_child_fees' then
    select c.approved_player_id into v_player_id
      from public.registration_children c where c.id=new.child_id;
    if v_player_id is null then return new; end if;
    v_amount:=new.monthly_amount;
    v_updated_by:=new.updated_by;
  else
    return new;
  end if;
  if v_updated_by is null then return new; end if;
  insert into public.player_recurring_fees(player_id,monthly_amount,updated_by,updated_at)
  values(v_player_id,v_amount,v_updated_by,now())
  on conflict(player_id) do update
   set monthly_amount=excluded.monthly_amount,updated_by=excluded.updated_by,updated_at=now();
  return new;
end
$$;
revoke all on function public.mirror_approved_child_fee() from public,anon,authenticated;
drop trigger if exists mirror_fee_on_player_approval on public.registration_children;
create trigger mirror_fee_on_player_approval
after update of approved_player_id on public.registration_children
for each row when (new.approved_player_id is not null)
execute function public.mirror_approved_child_fee();
drop trigger if exists mirror_fee_on_child_discount on public.registration_child_fees;
create trigger mirror_fee_on_child_discount
after insert or update of monthly_amount on public.registration_child_fees
for each row execute function public.mirror_approved_child_fee();
