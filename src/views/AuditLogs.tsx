import { useState, useMemo } from 'react';
import { Shield, Search, Filter, Clock, FileText, LogIn, Download } from 'lucide-react';
import type { AuditLog, Lang, Role } from '@/types';
import { PageHeader, EmptyState, Badge } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface AuditLogsProps {
  auditLogs: AuditLog[];
  loginLogs: AuditLog[];
  activeRole: Role;
  lang: Lang;
}

type TabId = 'activity' | 'logins';

const ACTION_COLORS: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'gray'> = {
  create: 'green', add: 'green', insert: 'green',
  update: 'blue', edit: 'blue', modify: 'blue',
  delete: 'red', remove: 'red',
  login: 'green', logout: 'amber',
};

function actionColor(action: string): 'green' | 'blue' | 'amber' | 'red' | 'gray' {
  const lower = action.toLowerCase();
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'gray';
}

function exportCsv(logs: AuditLog[], filename: string) {
  const header = 'Timestamp,User,Role,Action,Details';
  const rows = logs.map((l) =>
    [l.timestamp, l.userName, l.userRole, l.action, `"${(l.details || '').replace(/"/g, '""')}"`].join(',')
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLogs({ auditLogs, loginLogs, activeRole, lang }: AuditLogsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<TabId>('activity');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const logs = tab === 'activity' ? auditLogs : loginLogs;

  const roles = useMemo(() => {
    const set = new Set(logs.map((l) => l.userRole).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs
      .filter((l) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !l.userName.toLowerCase().includes(q) &&
            !l.action.toLowerCase().includes(q) &&
            !(l.details || '').toLowerCase().includes(q)
          ) return false;
        }
        if (roleFilter !== 'all' && l.userRole !== roleFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, search, roleFilter]);

  if (activeRole !== 'manager') {
    return (
      <div className="text-center py-20" dir={isAr ? 'rtl' : 'ltr'}>
        <Shield className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          {isAr ? t.managerOnly : 'This page is only available to the system manager'}
        </p>
      </div>
    );
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: 'activity', label: t.activityLog, icon: FileText },
    { id: 'logins', label: t.loginLog, icon: LogIn },
  ];

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t.auditLogs}
        subtitle={`${filtered.length} ${isAr ? 'سجل' : 'records'}`}
      >
        <button
          onClick={() => exportCsv(filtered, `${tab}-logs-${Date.now()}.csv`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold transition cursor-pointer"
        >
          <Download className="h-4 w-4" />
          {isAr ? 'تصدير CSV' : t.exportCsv}
        </button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === tb.id
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none rtl:right-3 ltr:left-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchLogs}
            className="w-full bg-white dark:bg-slate-900 text-sm py-2.5 pr-10 pl-3 rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 text-sm py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع الأدوار' : 'All Roles'}</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={isAr ? 'لا توجد سجلات' : 'No logs found'}
          subtitle={isAr ? 'لا توجد سجلات تطابق معايير البحث' : 'No logs match your search criteria'}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isAr ? 'الوقت' : 'Timestamp'}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.userName}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.userRole}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.action}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.details}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.slice(0, 200).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="tabular-nums">{formatDate(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                          {log.userName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge color="slate">{log.userRole}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge color={actionColor(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={log.details}>
                        {log.details || '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500 font-semibold">
              {isAr ? `يتم عرض أحدث 200 سجل من أصل ${filtered.length}` : `Showing latest 200 of ${filtered.length} records`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
