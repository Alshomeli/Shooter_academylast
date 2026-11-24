/** Draft pricing rules for registration review. Financial writes must be server-authorized. */
export const BASE_MONTHLY_FEE_BHD = 25;
export type ChildPrice = { childId: string; baseAmount: number; approvedAmount: number };
export function priceChildren(childIds: string[], overrides: Record<string,number> = {}): ChildPrice[] {
  return childIds.map(childId => {
    const override = overrides[childId];
    const approvedAmount = override === undefined ? BASE_MONTHLY_FEE_BHD : override;
    if (!Number.isFinite(approvedAmount) || approvedAmount < 0 || approvedAmount > BASE_MONTHLY_FEE_BHD || Math.round(approvedAmount*1000)!==approvedAmount*1000) {
      throw new Error('Invalid manager-approved fee');
    }
    return {childId,baseAmount:BASE_MONTHLY_FEE_BHD,approvedAmount};
  });
}
export function familyAmount(prices: ChildPrice[]): number {
  return Math.round(prices.reduce((sum, item) => sum + item.approvedAmount, 0)*1000)/1000;
}
/** Verification of uploaded transfer screenshots is advisory only:
 * never activate a player or mark a subscription paid based on OCR.
 * Only the academy's authorized review RPC may approve and post a payment. */

