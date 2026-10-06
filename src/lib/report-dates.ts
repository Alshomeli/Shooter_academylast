export type DateRangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

export function academyToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getDateRange(preset: DateRangePreset, today = academyToday()): [string, string] {
  const [year, month] = today.split('-').map(Number);
  const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  switch (preset) {
    case 'this_month': return [iso(year, month - 1, 1), iso(year, month, 0)];
    case 'last_month': return [iso(year, month - 2, 1), iso(year, month - 1, 0)];
    case 'last_3_months': return [iso(year, month - 3, 1), today];
    case 'this_year': return [`${year}-01-01`, `${year}-12-31`];
    default: return ['', ''];
  }
}

export type LifecycleStatus = 'active' | 'expiring' | 'expired' | 'future';
export function getLifecycleStatus(sub: { startDate: string; endDate: string }, today = academyToday()): LifecycleStatus {
  if (sub.startDate > today) return 'future';
  if (sub.endDate < today) return 'expired';
  const daysLeft = Math.round((Date.parse(sub.endDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  return daysLeft <= 7 ? 'expiring' : 'active';
}
