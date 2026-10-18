import { createFamilyAllocation, type FamilySubscriptionDue } from './family-payment-allocation';

export type FamilyReceiptState = 'pending' | 'needs_info' | 'rejected' | 'approved';
export type FamilyReceiptReview = {
  id: string;
  parentUserId: string;
  status: FamilyReceiptState;
  expectedAmount: number;
  allocations: FamilySubscriptionDue[];
};
export type FamilyPosting = {
  receiptId: string;
  subscriptionId: string;
  playerId: string;
  amount: number;
  transactionId: string;
};
/**
 * A deterministic approval plan, NOT a payment confirmation.
 * The future server RPC must recompute this plan from locked DB rows and verify
 * the actual bank transfer, staff authorization and subscription state.
 */
export function planFamilyReceiptApproval(receipt: FamilyReceiptReview): FamilyPosting[] {
  if (!receipt.id || receipt.status !== 'pending') throw new Error('Receipt not pending');
  const { allocations, totalAmount } = createFamilyAllocation(receipt.parentUserId, receipt.allocations);
  if (Math.round(totalAmount * 1000) !== Math.round(receipt.expectedAmount * 1000) ||
      !Number.isFinite(receipt.expectedAmount)) throw new Error('Receipt total mismatch');
  return allocations.map(a => ({
    receiptId: receipt.id,
    subscriptionId: a.subscriptionId,
    playerId: a.playerId,
    amount: a.amount,
    transactionId: `txn-family-${receipt.id}-${a.subscriptionId}`,
  }));
}
