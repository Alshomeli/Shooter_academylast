import { Phone, MessageCircle, Mail, AlertCircle, Clock, CheckCircle, Bell } from 'lucide-react';
import type { ReminderInfo } from '@/lib/reminders';
import type { Lang } from '@/types';
import { Badge } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface RemindersPanelProps {
  reminders: ReminderInfo[];
  onNavigate?: () => void;
  compact?: boolean;
  lang?: Lang;
}

export function RemindersPanel({ reminders, onNavigate, compact, lang = 'ar' }: RemindersPanelProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const visible = compact ? reminders.slice(0, 4) : reminders;

  const STATUS_CONFIG = {
    overdue: { color: 'red' as const, icon: AlertCircle, label: t.overdue, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/30' },
    expiring: { color: 'amber' as const, icon: Clock, label: t.expiring, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/30' },
    active: { color: 'emerald' as const, icon: CheckCircle, label: t.active, bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/30' },
  };

  if (reminders.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 mb-3">
          <CheckCircle className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {isAr ? 'جميع الاشتراكات مسددة' : 'All subscriptions are paid'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {isAr ? 'لا توجد تذكيرات متأخرة حالياً' : 'No overdue reminders at this time'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {isAr ? 'تذكيرات الاشتراكات' : 'Subscription Reminders'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {reminders.length} {isAr ? 'اشتراك يحتاج متابعة' : 'subscriptions need attention'}
            </p>
          </div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer">
            {t.viewAll}
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {visible.map((r) => {
          const cfg = STATUS_CONFIG[r.status];
          const Icon = cfg.icon;
          const playerName = r.player?.name || t.unknownPlayer;
          return (
            <div key={r.subscription.id} className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
              <div className={`shrink-0 w-9 h-9 rounded-lg bg-${cfg.color}-100 dark:bg-${cfg.color}-900/30 text-${cfg.color}-600 flex items-center justify-center`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{playerName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge color={cfg.color}>{cfg.label}</Badge>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {r.daysUntilExpiry < 0
                      ? (isAr ? `متأخر ${Math.abs(r.daysUntilExpiry)} يوم` : `${Math.abs(r.daysUntilExpiry)} days overdue`)
                      : r.daysUntilExpiry === 0
                        ? (isAr ? 'ينتهي اليوم' : 'Expires today')
                        : (isAr ? `باقي ${r.daysUntilExpiry} يوم` : `${r.daysUntilExpiry} days left`)}
                  </span>
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{r.subscription.amount} {t.currency}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.whatsappLink && (
                  <a
                    href={r.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                    title={isAr ? 'إرسال واتساب' : 'Send WhatsApp'}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
                {r.phoneLink && (
                  <a
                    href={r.phoneLink}
                    className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition cursor-pointer"
                    title={isAr ? 'اتصال هاتفي' : 'Phone call'}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                {r.emailLink && (
                  <a
                    href={r.emailLink}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title={isAr ? 'إرسال بريد' : 'Send email'}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
