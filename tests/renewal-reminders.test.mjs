import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSubscriptionReminders, reminderStats, generateReminderNotifications } from '../src/lib/reminders.ts';
import { normalizeWhatsAppPhone } from '../src/lib/whatsapp-phone.ts';
const paid = { id:'paid',playerId:'p',status:'paid',startDate:'2026-09-01',endDate:'2026-10-17',amount:35,planType:'monthly' };
test('Bahrain midnight includes paid renewal on expiry day without changing payment history', () => {
 const now=new Date('2026-10-17T21:30:00Z');
 const items=getSubscriptionReminders([paid],[],[],now);
 assert.equal(items.length,1); assert.equal(items[0].daysUntilExpiry,-1);
 assert.equal(paid.status,'paid');
 const notifications=generateReminderNotifications([paid],[],[],now);
 assert.match(notifications[0].message,/الفترة السابقة مسددة/);
 assert.doesNotMatch(notifications[0].message,/لتسديد المبلغ/);
 assert.equal(generateReminderNotifications([paid],[],notifications,now).length,1);
});
test('renewed periods suppress old paid reminders and unpaid totals exclude paid history', () => {
 const renewal={...paid,id:'renewal',status:'unpaid',startDate:'2026-10-18',endDate:'2026-11-18',amount:40};
 const r=getSubscriptionReminders([paid,renewal],[],[],new Date('2026-10-18T12:00:00Z'));
 assert.deepEqual(r.map(x=>x.subscription.id),['renewal']);
 const stats=reminderStats([paid,renewal],[],[]);
 assert.equal(stats.totalUnpaidAmount,40); assert.equal(stats.totalUnpaid,1);
});
test('today expiry generates a reminder and local WhatsApp numbers gain Bahrain prefix', () => {
 const now=new Date('2026-10-17T10:00:00Z');
 assert.equal(generateReminderNotifications([paid],[],[],now).length,1);
 const player={id:'p',parentPhone:'3228 7776'};
 assert.equal(getSubscriptionReminders([paid],[player],[],now)[0].whatsappLink,'https://wa.me/97332287776');
 assert.equal(normalizeWhatsAppPhone('٣٢٢٨٧٧٧٦'),'97332287776');
 assert.equal(normalizeWhatsAppPhone('00973 32287776'),'97332287776');
 assert.equal(normalizeWhatsAppPhone('+44 7700 900123'),'447700900123');
 assert.equal(normalizeWhatsAppPhone('bad'),'');
});
