-- Repair stale table names referenced by internal.force_delete_user.
-- Fail closed on historical financial/approval dependencies; no payment records are deleted.
-- Existing manager-only/self-deletion authorization remains unchanged.
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

    -- Never detach historic payment/approval ownership during forced deletion.
    if exists (select 1 from public.payment_proofs where reviewed_by = p_target_id)
       or exists (select 1 from public.family_payment_receipts where reviewed_by = p_target_id)
       or exists (select 1 from public.subscription_support where granted_by = p_target_id)
       or exists (select 1 from public.preplatform_coverage where approved_by = p_target_id)
    then
      raise exception 'Cannot delete staff with financial or approval history. Deactivate instead.'
        using errcode='23503';
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

    -- Delete the staff row
    delete from public.staff where id = p_target_id;

    return jsonb_build_object('success', true, 'targetType', 'staff', 'targetId', p_target_id);

  elsif p_target_type = 'player' then
    if not exists (select 1 from public.players where id = p_target_id) then
      raise exception 'Player not found';
    end if;

    -- Preserve all payment evidence, receipt allocations and fee history.
    if exists (select 1 from public.payment_proofs where player_id = p_target_id)
       or exists (select 1 from public.family_payment_receipt_items where player_id = p_target_id)
       or exists (select 1 from public.player_recurring_fees where player_id = p_target_id)
       or exists (select 1 from public.subscription_support where player_id = p_target_id)
       or exists (select 1 from public.preplatform_coverage where player_id = p_target_id)
    then
      raise exception 'Cannot delete player with financial or approval history. Archive instead.'
        using errcode='23503';
    end if;

    -- Delete the player row
    delete from public.players where id = p_target_id;

    return jsonb_build_object('success', true, 'targetType', 'player', 'targetId', p_target_id);

  else
    raise exception 'Invalid target type. Use ''staff'' or ''player''';
  end if;
end
$function$;

