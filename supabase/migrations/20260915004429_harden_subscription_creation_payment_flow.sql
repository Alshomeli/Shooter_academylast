drop policy if exists insert_subscriptions_authorized on public.subscriptions;
create policy insert_subscriptions_authorized on public.subscriptions
for insert to authenticated
with check (
  internal.has_role(ARRAY['manager'::text])
  OR (
    internal.has_role(ARRAY['accountant'::text, 'receptionist'::text])
    AND status = 'unpaid'
    AND paid_at IS NULL
    AND NULLIF(trim(COALESCE(payment_method, '')), '') IS NULL
  )
);
