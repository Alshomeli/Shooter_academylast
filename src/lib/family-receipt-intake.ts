import { createFamilyAllocation, type FamilySubscriptionDue } from './family-payment-allocation';

/** Validate a YYYY-MM-DD calendar day without Date.parse normalization. */
export function isValidBillingDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(day + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

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
  // An individual player must not be billed twice in one transfer.
  if (new Set(dues.map(d => d.playerId)).size !== dues.length) {
    throw new Error('Duplicate player in shared receipt');
  }
  // A shared receipt covers one billing cycle. Never combine future renewals
  // with a current month, even if the same family owns every subscription.
  const period = dues[0]?.startDate + '/' + dues[0]?.endDate;
  if (dues.some(d => !isValidBillingDay(d.startDate) || !isValidBillingDay(d.endDate) ||
      d.startDate > d.endDate || d.startDate + '/' + d.endDate !== period)) {
    throw new Error('Mixed or invalid billing periods');
  }

  if (!isValidBillingDay(transferDate)) throw new Error('Invalid transfer date');
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

/**
 * Prepare the private storage key for a future authenticated upload.
 * This does not upload or submit a receipt. Server still verifies object ownership.
 */
export function familyReceiptStoragePath(parentUserId: string, receiptId: string, mimeType: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentUserId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receiptId)) {
    throw new Error('Invalid private receipt identifier');
  }
  const ext: Record<string,string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  if (!ext[mimeType]) throw new Error('Unsupported receipt format');
  return `${parentUserId}/family/${receiptId}.${ext[mimeType]}`;
}
