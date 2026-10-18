import { createFamilyAllocation, type FamilySubscriptionDue } from './family-payment-allocation';

export type FamilyReceiptState = 'pending' | 'needs_info' | 'rejected' | 'approved';
export interface FamilyReceiptReview {
  id: string;
  parentUserId: string;
  status: FamilyReceiptState;
  expectedAmount: number;
  allocations: FamilySubscriptionDue[];
}
export interface FamilyPosting {
  receiptId: string;
  subscriptionId: string;
  playerId: string;
  amount: number;
  transactionId: string;
}
/** Deterministic review plan only; does not prove bank settlement or write transactions.
 * Future server-side approval must recheck locked subscription rows, roles, ownership,
 * exact amount, and unique transaction IDs inside one database transaction.
 */
export function planFamilyReceiptApproval(receipt: FamilyReceiptReview): FamilyPosting[] {
  if (!receipt.id || receipt.status !== 'pending') throw new Error('Receipt not pending');
  const { allocations, totalAmount } = createFamilyAllocation(receipt.parentUserId, receipt.allocations);
  if (!Number.isFinite(receipt.expectedAmount) ||
      Math.round(receipt.expectedAmount * 1000) !== Math.round(totalAmount * 1000) ||
      Math.abs(receipt.expectedAmount * 1000 - Math.round(receipt.expectedAmount * 1000)) > 0.000001) {
    throw new Error('Receipt total mismatch');
  }
  return allocations.map(a => ({
    receiptId: receipt.id,
    subscriptionId: a.subscriptionId,
    playerId: a.playerId,
    amount: a.amount,
    transactionId: `txn-family-${receipt.id}-${a.subscriptionId}`,
  }));
}
