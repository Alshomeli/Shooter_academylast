/*
# Force-delete any user (staff or player) — manager-only, bypasses all protections

## Purpose
Provides a single RPC that allows a manager to permanently delete any user
(staff member or player) while automatically cleaning up all dependent rows
that would otherwise block deletion via RESTRICT foreign key constraints.

This bypasses guards like the coach-reassignment requirement in
delete_staff_member_safely — teams are simply unassigned (coach_id set to null)
instead of requiring a replacement coach.

## Security
- SECURITY DEFINER, set search_path to ''
- Manager-only via internal.has_role(array['manager'])
- Blocks self-deletion via internal.current_staff_id() (staff targets only)
- Public SQL wrapper delegates to internal version
- EXECUTE granted to authenticated only

## What it cleans up before deleting a STAFF member:
1. Nullifies teams.coach_id where it references the target (bypasses reassignment requirement)
2. Nullifies teams.goalkeeper_coach_id where it references the target
3. Deletes staff_documents rows for the target
4. Nullifies parent_payment_proofs.reviewed_by where it references the target
5. Nullifies manager_subscription_support.granted_by where it references the target
6. Nullifies manager_preplatform_coverage.approved_by where it references the target
7. Deletes the staff row

## What it cleans up before deleting a PLAYER:
1. Deletes player_recurring_fees rows for the target
2. Deletes parent_payment_proofs rows for the target
3. Deletes family_payment_receipt_batches rows for the target
4. Deletes manager_subscription_support rows for the target
5. Deletes manager_preplatform_coverage rows for the target
6. Deletes the player row
(player_evaluations, transactions, telegram_attendance_tokens use CASCADE/SET NULL and are handled by the DB automatically)

## Idempotency
Uses CREATE OR REPLACE FUNCTION. Safe to re-run.
*/

-- Internal function
create or replace function internal.force_delete_user(
  p_target_type text,
  p_target_id text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_current_staff_id text := internal.current_staff_id();
begin
  if (select internal.has_role(array['manager'::text])) is not true then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if p_target_type = 'staff' then
    if p_target_id = v_current_staff_id then
      raise exception 'You cannot delete your own active staff account';
    end if;

    if not exists (select 1 from public.staff where id = p_target_id) then
      raise exception 'Staff member not found';
    end if;

    -- Nullify team coach assignments (bypasses reassignment requirement)
    update public.teams
      set coach_id = null, row_version = row_version + 1
      where coach_id = p_target_id;

    update public.teams
      set goalkeeper_coach_id = null, row_version = row_version + 1
      where goalkeeper_coach_id = p_target_id;

    -- Delete staff documents
    delete from public.staff_documents where staff_id = p_target_id;

    -- Nullify reviewer references
    update public.parent_payment_proofs
      set reviewed_by = null
      where reviewed_by = p_target_id;

    -- Nullify granted_by references
    update public.manager_subscription_support
      set granted_by = null
      where granted_by = p_target_id;

    -- Nullify approved_by references
    update public.manager_preplatform_coverage
      set approved_by = null
      where approved_by = p_target_id;

    -- Delete the staff row
    delete from public.staff where id = p_target_id;

    return jsonb_build_object('success', true, 'targetType', 'staff', 'targetId', p_target_id);

  elsif p_target_type = 'player' then
    if not exists (select 1 from public.players where id = p_target_id) then
      raise exception 'Player not found';
    end if;

    -- Delete dependent rows with RESTRICT FKs
    delete from public.player_recurring_fees where player_id = p_target_id;
    delete from public.parent_payment_proofs where player_id = p_target_id;
    delete from public.family_payment_receipt_batches where player_id = p_target_id;
    delete from public.manager_subscription_support where player_id = p_target_id;
    delete from public.manager_preplatform_coverage where player_id = p_target_id;

    -- Delete the player row
    delete from public.players where id = p_target_id;

    return jsonb_build_object('success', true, 'targetType', 'player', 'targetId', p_target_id);

  else
    raise exception 'Invalid target type. Use ''staff'' or ''player''';
  end if;
end
$function$;

-- Public SQL wrapper
create or replace function public.force_delete_user(
  p_target_type text,
  p_target_id text
)
returns jsonb
language sql
set search_path to ''
as $function$
  select internal.force_delete_user(p_target_type, p_target_id)
$function$;

-- Revoke all from public/anon, grant execute to authenticated only
revoke all on function internal.force_delete_user(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.force_delete_user(text, text)
  from public, anon, authenticated, service_role;

grant execute on function internal.force_delete_user(text, text) to authenticated;
grant execute on function public.force_delete_user(text, text) to authenticated;