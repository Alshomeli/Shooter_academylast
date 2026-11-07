/*
# Add "exempt" subscription status

1. Purpose
   The academy manager needs the ability to mark a player's subscription as
   "exempt" (معفي) without specifying a plan type, duration, or amount.
   Later the manager can convert the exempt subscription into a normal
   paid/unpaid subscription.

2. Changes
   - `chk_subscriptions_status` constraint: allow 'exempt' in addition to
     'unpaid' and 'paid'.
   - `chk_subscriptions_paid_consistency` constraint: exempt rows must have
     null paid_at and null payment_method (no payment evidence), and are
     allowed to have empty-string start/end dates and zero amount.

3. Security
   No RLS or policy changes — existing subscription policies still apply.
   The exempt status is set by manager/accountant/receptionist through the
   existing CRUD policies already in place.

4. Important notes
   - Existing data is not affected; no rows are deleted or modified.
   - The migration is idempotent: constraints are dropped and recreated.
*/

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_status;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_paid_consistency;

ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status
  CHECK (status IN ('unpaid', 'paid', 'exempt'));

ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_paid_consistency
  CHECK (
    (status = 'paid'   AND paid_at IS NOT NULL AND COALESCE(payment_method, '') <> '')
    OR (status = 'unpaid' AND paid_at IS NULL)
    OR (status = 'exempt' AND paid_at IS NULL AND payment_method IS NULL)
  );