/** Pure family receipt allocation rules. No database writes. */
export interface FamilySubscriptionDue {
  subscriptionId: string;
  playerId: string;
  parentUserId: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'exempt';
  startDate: string;
  endDate: string;
}
export interface FamilyAllocation {
  subscriptionId: string;
  playerId: string;
  amount: number;
}
const fils = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 1000)) ||
      Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) {
    throw new Error('Amount must be nonnegative with a maximum of three decimals');
  }
  return Math.round(value * 1000);
};
/** Uploading one transfer receipt can cover any number of sibling subscriptions,
 * but all subscriptions must be unpaid and owned by the same parent.
 * Duplicate subscription IDs are rejected before any financial posting.
 * This total must be verified by the manager against the actual bank transfer. */
export function createFamilyAllocation(parentUserId: string, dues: FamilySubscriptionDue[]): {
  allocations: FamilyAllocation[];
  totalAmount: number;
} {
  if (!parentUserId || !dues.length) throw new Error('At least one unpaid subscription is required');
  if (new Set(dues.map(d => d.subscriptionId)).size !== dues.length) throw new Error('Duplicate subscription');
  const allocations = dues.map(d => {
    if (!d.subscriptionId || !d.playerId || d.parentUserId !== parentUserId || d.status !== 'unpaid') {
      throw new Error('Invalid subscription or parent ownership');
    }
    if (fils(d.amount) === 0) throw new Error('Zero-value subscriptions do not require payment');
    return { subscriptionId: d.subscriptionId, playerId: d.playerId, amount: d.amount };
  });
  const totalFils = allocations.reduce((sum, a) => sum + fils(a.amount), 0);
  if (!Number.isSafeInteger(totalFils)) throw new Error('Invalid family total');
  return { allocations, totalAmount: totalFils / 1000 };
}
