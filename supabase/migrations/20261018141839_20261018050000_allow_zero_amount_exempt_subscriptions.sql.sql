/*
# Allow zero-amount subscriptions for the exempt (معفي) status

1. Purpose
   The "exempt" subscription feature lets a manager mark a player as exempt
   from fees with no plan, duration, or amount. The client inserts these rows
   with amount = 0, but the database constraint
   `chk_subscriptions_amount_positive` (amount > 0) still rejects them, so
   every exempt subscription save fails.

2. Changes
   - Recreate `chk_subscriptions_amount_positive` so it accepts amount = 0
     only when status = 'exempt'; all other statuses still require
     amount > 0. Existing paid/unpaid rows remain valid.

3. Security
   No RLS or policy changes. The existing subscription policies still govern
   who can write rows.

4. Important notes
   - Idempotent: the constraint is dropped (if present) and recreated.
   - Existing data is not modified.
   - Constraints on `subscriptions` are validated after creation; existing
     rows already satisfy the new predicate (exempt rows do not exist yet).
*/

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_amount_positive;

ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_amount_positive
  CHECK (status = 'exempt' OR amount > 0);
