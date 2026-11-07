-- Approval, categorization and refund evidence are committed with their financial operation.
-- No existing payment, receipt, player or parent status is rewritten by this migration.
-- Zero means the coach has not assigned a jersey yet. It must not prevent
-- multiple new players from joining their age category; positive numbers stay unique.
drop index public.uq_players_team_jersey;
create unique index uq_players_team_jersey on public.players(team_id,jersey_number)
 where team_id is not null and jersey_number>0;
create function internal.birth_year_team(p_birth_date date) returns text
language plpgsql stable security definer set search_path='' as $$
declare v_team text; v_count int; v_year text:=extract(year from p_birth_date)::int::text;
begin
 select count(*),min(t.id) into v_count,v_team from public.teams t
 where t.status='active' and t.category_kind='team'
 and v_year=any(regexp_split_to_array(translate(coalesce(t.name,'')||' '||coalesce(t.age_group,''),
   '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]+'));
 if v_count<>1 then raise exception 'A unique active birth-year category is required for %',v_year; end if;
 return v_team;
end $$;
revoke all on function internal.birth_year_team(date) from public,anon,authenticated,service_role;

-- Only the nested, paid-subscription trigger may perform deterministic automatic
-- category assignment without a manager identity (accountant / Telegram approval).
-- Direct client edits retain the existing manager-only parent/team boundary.
create or replace function internal.guard_player_sensitive_columns()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if internal.is_academy_admin() is not true then
  if new.parent_id is distinct from old.parent_id then
   raise exception 'Only managers can change a player parent or team' using errcode='42501';
  end if;
  if new.team_id is distinct from old.team_id then
   if pg_trigger_depth()<=1 then
    raise exception 'Only managers can change a player parent or team' using errcode='42501';
   end if;
   if new.team_id is distinct from internal.birth_year_team(new.birth_date)
    or not exists(select 1 from public.subscriptions s where s.player_id=new.id and s.status='paid'
     and s.start_date<=(now() at time zone 'Asia/Bahrain')::date
     and s.end_date>=(now() at time zone 'Asia/Bahrain')::date)
   then raise exception 'Only managers can change a player parent or team' using errcode='42501'; end if;
  end if;
  if new.parent_email is distinct from old.parent_email and not exists(
    select 1 from public.parents p where p.id=new.parent_id and p.email=new.parent_email)
  then raise exception 'Only managers can modify parent_email' using errcode='42501'; end if;
  if new.notes is distinct from old.notes then
   raise exception 'Only managers can modify private player notes' using errcode='42501'; end if;
 end if;
 return new;
end $$;

create function internal.activate_paid_player() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_player public.players; v_team text; v_today date:=(now() at time zone 'Asia/Bahrain')::date;
begin
 if new.status<>'paid' or (tg_op='UPDATE' and old.status='paid')
  or new.start_date is null or new.end_date is null
  or new.start_date>v_today or new.end_date<v_today then return new; end if;
 select * into v_player from public.players where id=new.player_id for update;
 if not found or v_player.archived_at is not null then return new; end if;
 v_team:=internal.birth_year_team(v_player.birth_date);
 update public.players set team_id=v_team,status='active'
 where id=v_player.id and (team_id,status) is distinct from (v_team,'active');
 return new;
end $$;
revoke all on function internal.activate_paid_player() from public,anon,authenticated,service_role;
create trigger activate_paid_player after insert or update of status on public.subscriptions
for each row execute function internal.activate_paid_player();

-- Individual proof notifications already exist; add equivalent family submission
-- and correction notifications. A repeated pending update creates no duplicate.
create function internal.notify_managers_family_proof_pending() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'pending' or (tg_op='UPDATE' and old.status='pending') then return new; end if;
 insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
 select 'notif-family-review-'||gen_random_uuid()::text,'إثبات دفع أشقاء بانتظار المراجعة',
 'رفع ولي أمر إثبات دفع للأشقاء. راجعه من شاشة الاشتراكات.',now()::text,'warning',false,s.user_id
 from public.staff s where s.role='manager' and s.status='active' and s.user_id is not null;
 return new;
end $$;
revoke all on function internal.notify_managers_family_proof_pending() from public,anon,authenticated,service_role;
create trigger notify_managers_family_proof_pending after insert or update of status
on public.family_payment_receipts for each row execute function internal.notify_managers_family_proof_pending();

-- Each actual recorded refund receives its own immutable, stable receipt number.
-- Existing refund records also receive numbers; original subscription receipts remain intact.
alter table public.subscription_support add column refund_receipt_number bigint generated always as identity;
alter table public.subscription_support add constraint refund_receipt_number_unique unique(refund_receipt_number);
create function internal.can_view_refund(p_player_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.staff s where s.user_id=auth.uid() and s.status='active' and s.role in ('manager','accountant'))
  or exists(select 1 from public.players pl join public.parents pa on pa.id=pl.parent_id
    where pl.id=p_player_id and pa.user_id=auth.uid())
 );
$$;
revoke all on function internal.can_view_refund(text) from public,anon;
grant execute on function internal.can_view_refund(text) to authenticated;
create policy support_parent_read on public.subscription_support for select to authenticated
 using ((select internal.can_view_refund(player_id)));

create function internal.finish_withdrawal_participation() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_parent text; v_today date:=(now() at time zone 'Asia/Bahrain')::date;
begin
 if new.purpose<>'withdrawal' then return new; end if;
 select parent_id into v_parent from public.players where id=new.player_id;
 perform 1 from public.parents where id=v_parent for update;
 perform 1 from public.players where id=new.player_id for update;
 update public.players pl set status='inactive' where pl.id=new.player_id and pl.archived_at is null
 and not exists(select 1 from public.subscriptions s where s.player_id=pl.id and s.status in ('paid','exempt')
  and s.start_date<=v_today and s.end_date>=v_today);
 -- Preserve every sibling and the parent's account whenever more than one
 -- nonarchived child is linked. Exemption refunds never suspend participation.
 update public.parents pa set status='inactive' where pa.id=v_parent and pa.status='active'
 and (select count(*) from public.players pl where pl.parent_id=pa.id and pl.archived_at is null)=1
 and exists(select 1 from public.players pl where pl.id=new.player_id and pl.parent_id=pa.id and pl.status='inactive' and pl.archived_at is null);
 return new;
end $$;
revoke all on function internal.finish_withdrawal_participation() from public,anon,authenticated,service_role;
create trigger finish_withdrawal_participation after insert on public.subscription_support
 for each row execute function internal.finish_withdrawal_participation();
notify pgrst,'reload schema';
