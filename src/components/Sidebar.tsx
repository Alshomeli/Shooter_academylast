import {
  LayoutDashboard, ShieldCheck, Users, UsersRound,
  Trophy, Dumbbell, Wallet, ClipboardCheck, CalendarDays,
  BarChart3, Sparkles, Settings as SettingsIcon,
  LogOut, Moon, Sun, X, Medal, Star, ScrollText, Send,
  ClipboardList, FileCheck,
} from 'lucide-react';
import type { CurrentUser, Lang, Role, ViewId } from '@/types';
import { tr } from '@/lib/i18n';

interface SidebarProps {
  currentTab: ViewId;
  setCurrentTab: (v: ViewId) => void;
  activeRole: Role;
  setActiveRole: (r: Role) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  currentUser: CurrentUser;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  academyName?: string;
  logoUrl?: string;
}

interface NavItem {
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles: Role[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getRoleOptions(lang: Lang): { value: Role; label: string }[] {
  const t = tr(lang);
  return [
    { value: 'manager', label: t.manager },
    { value: 'accountant', label: t.accountant },
    { value: 'coach', label: t.coach },
    { value: 'receptionist', label: t.receptionist },
  ];
}

export function Sidebar({
  currentTab, setCurrentTab, activeRole, lang, setLang,
  darkMode, setDarkMode, currentUser, onLogout, mobileOpen, setMobileOpen,
  academyName, logoUrl,
}: SidebarProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const ROLE_OPTIONS = getRoleOptions(lang);
  const brandName = academyName?.trim() || t.academyShort;
  const fallbackLogo = '/شعار_أكاديمية_شوتر_ثلاثي_الأبعاد copy 2.png';
  const selectedLogo = logoUrl && /^(https?:\/\/|data:image\/|\/)/i.test(logoUrl.trim()) ? logoUrl : fallbackLogo;

  const navSections: NavSection[] = [
    {
      title: isAr ? 'الإدارة' : 'Administration',
      items: [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, allowedRoles: ['manager', 'accountant', 'coach', 'receptionist'] },
        { id: 'registration-admin', label: t.registrationAdmin, icon: FileCheck, allowedRoles: ['manager'] },
        { id: 'approvals', label: isAr ? 'الموافقات' : 'Approvals', icon: ShieldCheck, allowedRoles: ['manager'] },
        { id: 'players', label: t.players, icon: Users, allowedRoles: ['manager', 'receptionist', 'coach'] },
        { id: 'parents', label: t.parents, icon: UsersRound, allowedRoles: ['manager', 'receptionist', 'coach'] },
      ],
    },
    {
      title: isAr ? 'العمليات' : 'Operations',
      items: [
        { id: 'staff', label: t.staff, icon: Dumbbell, allowedRoles: ['manager'] },
        { id: 'subscriptions', label: t.subscriptions, icon: Wallet, allowedRoles: ['manager', 'accountant', 'receptionist'] },
        { id: 'attendance', label: t.attendance, icon: ClipboardCheck, allowedRoles: ['manager', 'coach', 'receptionist'] },
        { id: 'teams', label: t.teams, icon: Trophy, allowedRoles: ['manager', 'coach', 'receptionist'] },
        { id: 'schedules', label: t.schedules, icon: CalendarDays, allowedRoles: ['manager', 'coach'] },
        { id: 'tournaments', label: t.tournaments, icon: Medal, allowedRoles: ['manager', 'coach', 'receptionist'] },
        { id: 'evaluations', label: t.evaluations, icon: Star, allowedRoles: ['manager', 'coach'] },
      ],
    },
    {
      title: isAr ? 'النظام' : 'System',
      items: [
        { id: 'reports', label: t.reports, icon: BarChart3, allowedRoles: ['manager', 'accountant', 'coach', 'receptionist'] },
        { id: 'audit-logs', label: t.auditLogs, icon: ScrollText, allowedRoles: ['manager'] },
        { id: 'messages', label: t.messages, icon: Send, allowedRoles: ['manager', 'coach', 'receptionist', 'accountant'] },
        { id: 'ai-center', label: t.aiCenter, icon: Sparkles, allowedRoles: ['manager', 'accountant', 'coach', 'receptionist'] },
        { id: 'settings', label: t.settings, icon: SettingsIcon, allowedRoles: ['manager'] },
      ],
    },
  ];

  const visibleSections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.allowedRoles.includes(activeRole)) }))
    .filter((section) => section.items.length > 0);

  const handleNav = (id: ViewId) => {
    setCurrentTab(id);
    setMobileOpen(false);
  };



  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        id="sidebar"
        className={`shooter-sidebar fixed lg:sticky lg:top-0 inset-y-0 right-0 z-50 lg:z-auto w-72 flex flex-col shrink-0 shadow-2xl transition-all duration-300 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } ${darkMode ? 'bg-slate-950 text-slate-100 border-l border-slate-900' : 'bg-slate-900 text-white border-l border-slate-800'}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Logo header */}
          <div className="sidebar-brand relative p-3 lg:p-4 border-b border-slate-800 flex items-center gap-3 bg-brand-950/20 text-right lg:flex-col lg:text-center shrink-0">
            <div className="relative group shrink-0 w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center">
              <div className="absolute -inset-1 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000" style={{ backgroundColor: '#cbd5e1' }} />
              <img src={selectedLogo} alt={isAr ? 'شعار الأكاديمية' : 'Academy logo'} className="relative h-12 w-12 lg:h-16 lg:w-16 object-contain drop-shadow-lg" />
            </div>
            <div className="min-w-0 flex-1 lg:w-full">
              <h1 className="font-black text-xs lg:text-sm text-slate-200 tracking-tight leading-tight">{brandName}</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">SHOOTER ACADEMY</p>
              <p className="hidden lg:block text-[9px] text-brand-500 font-semibold mt-0.5">{t.systemTitle}</p>
            </div>
            <button onClick={() => setMobileOpen(false)} aria-label={lang === 'ar' ? 'إغلاق القائمة' : 'Close menu'} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-brand-500/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Signed-in identity and permission level (assigned by a manager) */}
          <div className="p-3 mx-3 my-2 rounded-xl shrink-0 bg-slate-800/40 border border-slate-700/40">
            <div className="w-full bg-slate-950 text-white text-[11px] font-semibold py-2 px-2.5 rounded-lg border border-slate-700">
              {ROLE_OPTIONS.find((r) => r.value === activeRole)?.label ?? activeRole}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-semibold">{t.active}: {currentUser.name.split(' ')[0]}</span>
            </div>
          </div>

          {/* Nav items */}
          <nav className="sidebar-nav flex-1 min-h-0 px-3 pb-3 space-y-3 overflow-y-auto overscroll-contain" aria-label={isAr ? 'أقسام القائمة الرئيسية' : 'Main navigation sections'}>
            {visibleSections.map((section) => (
              <div key={section.title}>
                <h2 className="px-3 mb-1.5 text-sm italic text-center font-black tracking-[0.16em] text-brand-500 bg-[#171b22] uppercase">{section.title}</h2>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-right ${
                          active
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={`truncate ${item.id === 'dashboard' ? 'text-left' : ''}`}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {activeRole === 'parent' && (
              <div>
                <h2 className="px-3 mb-1.5 text-sm italic text-center font-black tracking-[0.16em] text-brand-500 bg-[#171b22] uppercase">{isAr ? 'الإدارة' : 'Administration'}</h2>
                <button onClick={() => handleNav('registration')} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-right text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.registration}</span>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Footer controls */}
        <div className="sidebar-footer p-3 border-t border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? (lang === 'ar' ? 'تفعيل الوضع الفاتح' : 'Switch to light mode') : (lang === 'ar' ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 transition cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? (isAr ? 'فاتح' : 'Light') : (isAr ? 'داكن' : 'Dark')}
            </button>
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 transition cursor-pointer"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
              {lang === 'ar' ? ' English' : ' العربية'}
            </button>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t.logout}
          </button>
        </div>
      </aside>
    </>
  );
}

