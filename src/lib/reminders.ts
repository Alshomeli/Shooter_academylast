import type { Subscription, Player, Notification, Parent } from '@/types';

/** Days before expiry to send a reminder */
const REMINDER_DAYS = [7, 3, 1];
/** Days after expiry to flag as overdue */
const OVERDUE_GRACE = 0;

export interface ReminderInfo {
  subscription: Subscription;
  player: Player | undefined;
  parent: Parent | undefined;
  status: 'overdue' | 'expiring' | 'active';
  daysUntilExpiry: number;
  whatsappLink: string;
  phoneLink: string;
  emailLink: string;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

export function getSubscriptionReminders(
  subscriptions: Subscription[],
  players: Player[],
  parents: Parent[],
): ReminderInfo[] {
  const today = new Date().toISOString().substring(0, 10);
  return subscriptions
    .filter((s) => s.status === 'unpaid')
    .map((s) => {
      const player = players.find((p) => p.id === s.playerId);
      const parent = parents.find((p) => p.id === player?.parentId);
      const days = daysBetween(today, s.endDate);
      const status: ReminderInfo['status'] = days < OVERDUE_GRACE ? 'overdue' : days <= Math.max(...REMINDER_DAYS) ? 'expiring' : 'active';
      const phone = parent?.whatsappPhone || parent?.phone || player?.parentPhone || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const email = parent?.email || player?.parentEmail || '';
      return {
        subscription: s,
        player,
        parent,
        status,
        daysUntilExpiry: days,
        whatsappLink: cleanPhone ? `https://wa.me/${cleanPhone}` : '',
        phoneLink: cleanPhone ? `tel:${cleanPhone}` : '',
        emailLink: email ? `mailto:${email}` : '',
      };
    })
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export function generateReminderNotifications(
  subscriptions: Subscription[],
  players: Player[],
  existing: Notification[],
): Notification[] {
  const today = new Date().toISOString().substring(0, 10);
  const existingKeys = new Set(existing.map((n) => n.id));
  const newNotifs: Notification[] = [];

  for (const sub of subscriptions) {
    if (sub.status !== 'unpaid') continue;
    const player = players.find((p) => p.id === sub.playerId);
    const days = daysBetween(today, sub.endDate);
    const name = player?.name || 'لاعب غير معروف';

    if (days < OVERDUE_GRACE) {
      const id = `reminder-overdue-${sub.id}`;
      if (!existingKeys.has(id)) {
        newNotifs.push({
          id,
          title: 'اشتراك متأخر عن الدفع',
          message: `انتهى اشتراك اللاعب ${name} بتاريخ ${sub.endDate}. يرجى التواصل مع ولي الأمر لتسديد المبلغ ${sub.amount} د.ب`,
          timestamp: new Date().toISOString(),
          type: 'error',
          read: false,
        });
      }
    } else if (REMINDER_DAYS.includes(days)) {
      const id = `reminder-expiring-${sub.id}-${days}`;
      if (!existingKeys.has(id)) {
        newNotifs.push({
          id,
          title: days === 0 ? 'اشتراك ينتهي اليوم' : `اشتراك ينتهي بعد ${days} أيام`,
          message: `اشتراك اللاعب ${name} ينتهي بتاريخ ${sub.endDate}. المبلغ المستحق: ${sub.amount} د.ب`,
          timestamp: new Date().toISOString(),
          type: days <= 1 ? 'warning' : 'info',
          read: false,
        });
      }
    }
  }

  return [...newNotifs, ...existing];
}

export function reminderStats(subscriptions: Subscription[], players: Player[], parents: Parent[]) {
  const reminders = getSubscriptionReminders(subscriptions, players, parents);
  const overdue = reminders.filter((r) => r.status === 'overdue').length;
  const expiring = reminders.filter((r) => r.status === 'expiring').length;
  const active = reminders.filter((r) => r.status === 'active').length;
  const totalUnpaid = reminders.length;
  const totalUnpaidAmount = reminders.reduce((sum, r) => sum + r.subscription.amount, 0);
  return { overdue, expiring, active, totalUnpaid, totalUnpaidAmount, reminders };
}
