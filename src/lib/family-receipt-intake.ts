import { createFamilyAllocation, type FamilySubscriptionDue } from './family-payment-allocation';

export interface FamilyReceiptIntake {
  parentUserId: string;
  transferDate: string;
  subscriptionIds: string[];
  expectedAmount: number;
  fileName: string;
  fileMimeType: string;
}
/** Client-side preflight only. The server must independently verify ownership,
 * current balances, private proof upload and batch uniqueness before accepting.
 */
export function prepareFamilyReceiptIntake(
  parentUserId: string,
  dues: FamilySubscriptionDue[],
  transferDate: string,
  file: Pick<File, 'name' | 'type' | 'size'>,
): FamilyReceiptIntake {
  const { allocations, totalAmount } = createFamilyAllocation(parentUserId, dues);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDate) ||
      Number.isNaN(Date.parse(transferDate + 'T00:00:00Z'))) {
    throw new Error('Invalid transfer date');
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
    throw new Error('Unsupported receipt format');
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Receipt file must be 5 MB or smaller');
  }
  if (!file.name.trim()) throw new Error('Receipt file name required');
  return {
    parentUserId,
    transferDate,
    subscriptionIds: allocations.map(a => a.subscriptionId),
    expectedAmount: totalAmount,
    fileName: file.name,
    fileMimeType: file.type,
  };
}
