import type { Subscription } from '@/types';
/** Calendar months, clamped at month end, independent of the browser time zone. */
export function calcEndDate(startDate: string, planType: Subscription['planType']): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return startDate;
  const [year, month, day] = startDate.split('-').map(Number);
  const months = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 }[planType];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Renewal is a new unpaid period; historical payment evidence stays untouched. */
export function renewalDraft(subscription: Subscription, today: string): Omit<Subscription, 'id'> {
  const nextDay = new Date(subscription.endDate + 'T00:00:00Z');
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const startDate = today > nextDay.toISOString().slice(0, 10) ? today : nextDay.toISOString().slice(0, 10);
  return { playerId: subscription.playerId, planType: subscription.planType,
    amount: subscription.amount, startDate, endDate: calcEndDate(startDate, subscription.planType), status: 'unpaid' };
}
