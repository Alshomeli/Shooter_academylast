# Payment approval, birth categories and withdrawal receipts

Base: merged PR 71, main `436d6303f33113e0c34414e8bc76bb55ab5d340c`.
The user reported successful manual acceptance of registration, fee requests,
Benefit proof approval, training/attendance and cancellation/refund. This change
addresses the additional behavior requested after that acceptance.

## Behavior

- Individual proof submissions already notify active managers. A matching trigger
  now notifies them for family proof submissions and needs-info resubmissions;
  repeated updates while pending do not generate another notice.
- A new current-period paid subscription atomically activates its nonarchived
  player and assigns the unique active outfield category containing their birth
  year in its name or age-group field. Arabic/Persian digits are normalized.
  Goalkeeper and inactive groups are excluded. Missing/ambiguous categories abort
  the entire approval, including its financial entries, with a bilingual message.
- This database trigger applies to platform, accountant, manager, family and
  Telegram payment approval. Future/expired coverage does not activate a player.
  Jersey 0 remains unassigned and may repeat; positive team jersey numbers remain
  unique. Coaches can complete jersey/position details later.
- Each actually recorded withdrawal refund receives a stable `SR-` receipt
  number. Cancellation alone does not claim a payout. Partial refunds each have
  their own receipt, linked original-payment reference, amount, method and date.
- Manager and parent views show printable refund receipts instead of the
  cancelled subscription's payment receipt. Original payments/proofs/ledger
  records remain immutable and linked. Cross-parent receipt reads are denied.
- After an actual withdrawal refund, a player without other current paid/exempt
  coverage is inactive. A parent with exactly one nonarchived, now-inactive child
  also becomes inactive. Multiple-child parents and siblings are unchanged.
  Exemption refunds do not run this suspension rule. Supabase Auth is not deleted
  or banned; the existing application-level inactive-account gate is preserved.

## Verification and limits

Local lint/typecheck/build and 322 tests passed before the final focused jersey
regression, which also passed. Focused PostgreSQL tests cover accountant/Telegram
approval, category ambiguity rollback, zero/positive jersey uniqueness, retry,
immutable receipts, one-child versus siblings, notification correction and RLS.
The disposable real Supabase workflow is enabled for this branch and extends
the existing Auth/Storage journey to payment activation and refund lifecycle.
Its actual result must be checked before release; no production test rows or
real notifications are sent by these tests.

## Production state and application

No production migration or web deployment has been performed for this change.
Read-only inspection found the PR 71 Telegram repair is **not yet applied**:
the old service-role guard remains, recent flushes fail, and 51 login notices
are pending. A GitHub merge does not apply Supabase migrations by itself.

Review and apply the pending Telegram repair and this new forward migration
separately through the approved production release process, matching catalog
definitions rather than replaying unrelated historical migrations. Applying the
Telegram repair permits the existing dispatcher to resume queued messages;
review the intended recipients and pending backlog first.

This migration creates no payment/refund and changes no existing player/parent
status. Adding the refund identity column numbers existing refund records and
requires a table lock; replacing the jersey index also requires a brief lock.
Capture schema/function/policy definitions before application. Once receipts
have been issued, preserve their numbers and financial evidence during recovery;
do not drop or renumber receipt data as a rollback shortcut. An application
rollback alone does not remove the new database behavior.
