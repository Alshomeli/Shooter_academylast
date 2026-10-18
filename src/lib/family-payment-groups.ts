/** Select one unpaid billing period shared by at least two distinct siblings. */
export interface UnpaidFamilySubscription {
  id: string; playerId?: string | null; amount: number; status: string;
  startDate: string; endDate: string;
}
export function siblingPaymentGroups(
  subscriptions: UnpaidFamilySubscription[],
  allowedPlayerIds: string[],
  blockedSubscriptionIds: string[],
): Array<{ period: string; subscriptions: UnpaidFamilySubscription[]; amount: number }> {
  const players = new Set(allowedPlayerIds);
  const blocked = new Set(blockedSubscriptionIds);
  const groups = new Map<string, UnpaidFamilySubscription[]>();
  for (const sub of subscriptions) {
    if (sub.status !== 'unpaid' || !sub.playerId || !players.has(sub.playerId) || blocked.has(sub.id)) continue;
    if (!Number.isFinite(sub.amount) || sub.amount <= 0) continue;
    const period = sub.startDate + ' / ' + sub.endDate;
    const group = groups.get(period) || [];
    if (group.some(existing => existing.playerId === sub.playerId)) continue;
    group.push(sub);
    groups.set(period, group);
  }
  return [...groups].filter(([, subs]) => subs.length > 1)
    .map(([period, subs]) => ({
      period, subscriptions: subs,
      amount: subs.reduce((sum, sub) => sum + Math.round(sub.amount * 1000), 0) / 1000,
    })).sort((a,b) => b.period.localeCompare(a.period));
}
