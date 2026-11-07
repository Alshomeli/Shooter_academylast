import { useState } from 'react';
import {
  Smartphone, Download, Bell, MessageSquare, Share2, QrCode,
  CheckCircle, Settings, Wifi, Battery, Signal, MessageCircle, Phone, Globe,
} from 'lucide-react';
import type { Player, Team, Staff, Subscription, Transaction, Match, Training, Lang, Role } from '@/types';
import { Badge, PageHeader, StatCard } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface MobileViewProps {
  players: Player[];
  teams: Team[];
  staff: Staff[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  trainings: Training[];
  matches: Match[];
  activeRole: Role;
  lang: Lang;
}

const ACADEMY_PHONE = '97317123456';
const ACADEMY_EMAIL = 'info@shooter-academy.com';

export function MobileView({ subscriptions, lang }: MobileViewProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState('preview');

  const unpaidCount = subscriptions.filter((s) => s.status === 'unpaid').length;

  return (
    <div className="space-y-5 text-right" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader title={t.mobile} subtitle={isAr ? 'معاينة تطبيق الجوال ولوحة تحكم الـ API' : 'Mobile app preview and API dashboard'} />

      {/* Tab navigation */}
      <div className="flex gap-1.5">
        {[
          { id: 'preview', label: isAr ? 'معاينة التطبيق' : 'App Preview', icon: Smartphone },
          { id: 'api', label: isAr ? 'واجهة API' : 'API Access', icon: Settings },
          { id: 'notifications', label: isAr ? 'الإشعارات' : 'Notifications', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="relative w-72 h-[580px] bg-slate-950 rounded-[3rem] border-8 border-slate-800 shadow-2xl overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-10" />
              {/* Status bar */}
              <div className="pt-8 px-5 pb-2 flex items-center justify-between text-white text-[10px] font-bold">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <Signal className="h-3 w-3" />
                  <Wifi className="h-3 w-3" />
                  <Battery className="h-3 w-3" />
                </div>
              </div>
              {/* App content */}
              <div className="px-4 pb-4 h-full overflow-y-auto">
                <div className="flex items-center gap-2 mb-4 pt-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-lg">🎯</div>
                  <div>
                    <p className="text-white text-sm font-black">{t.academyName}</p>
                    <p className="text-emerald-400 text-[9px]">{isAr ? 'ولي الأمر' : 'Parent'}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-slate-800/60 rounded-xl p-3">
                    <p className="text-[9px] text-slate-400 font-bold">{isAr ? 'أبنائي' : 'My children'}</p>
                    <p className="text-lg font-black text-white">2</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3">
                    <p className="text-[9px] text-slate-400 font-bold">{isAr ? 'اشتراكات متأخرة' : 'Overdue subs'}</p>
                    <p className="text-lg font-black text-amber-400">{unpaidCount > 0 ? unpaidCount : '0'}</p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="space-y-2">
                  {[
                    { label: isAr ? 'الحضور والغياب' : 'Attendance', icon: '✅', color: 'bg-emerald-900/40' },
                    { label: isAr ? 'جدول التدريبات' : 'Training schedule', icon: '📅', color: 'bg-blue-900/40' },
                    { label: isAr ? 'نتائج المباريات' : 'Match results', icon: '⚽', color: 'bg-amber-900/40' },
                    { label: isAr ? 'دفع الاشتراك' : 'Pay subscription', icon: '💳', color: 'bg-red-900/40' },
                    { label: isAr ? 'التواصل مع المدرب' : 'Contact coach', icon: '💬', color: 'bg-slate-800' },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.color} cursor-pointer hover:scale-[1.02] transition`}>
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-xs font-bold text-white flex-1">{item.label}</span>
                      <span className="text-slate-500 text-xs">←</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* App info */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'تطبيق ولي الأمر' : 'Parent App'}</h3>
                  <p className="text-[11px] text-slate-400">{isAr ? 'متوفر على iOS و Android' : 'Available on iOS and Android'}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {isAr ? 'تطبيق جوال متكامل لأولياء الأمور لمتابعة حضور أبنائهم، نتائج المباريات، جدول التدريبات، ودفع الاشتراكات الشهرية إلكترونياً.' : 'A complete mobile app for parents to track their children\'s attendance, match results, training schedules, and pay monthly subscriptions electronically.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a href="https://apps.apple.com/bh/app/shooter-academy" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800 transition">
                  <Download className="h-4 w-4" /> App Store
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.shooter.academy" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800 transition">
                  <Download className="h-4 w-4" /> Google Play
                </a>
              </div>

              {/* Direct contact deep links */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <a href={`https://wa.me/${ACADEMY_PHONE}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition cursor-pointer">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{isAr ? 'واتساب' : 'WhatsApp'}</span>
                </a>
                <a href={`tel:${ACADEMY_PHONE}`} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer">
                  <Phone className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{isAr ? 'اتصال' : 'Call'}</span>
                </a>
                <a href={`mailto:${ACADEMY_EMAIL}`} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                  <Globe className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{isAr ? 'بريد' : 'Email'}</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Download className="h-5 w-5" />} label={isAr ? 'تحميلات التطبيق' : 'App downloads'} value="1,247" sublabel={isAr ? 'ولي أمر نشط' : 'Active parents'} color="emerald" />
              <StatCard icon={<Bell className="h-5 w-5" />} label={isAr ? 'إشعارات مرسلة' : 'Notifications sent'} value="3,892" sublabel={isAr ? 'هذا الشهر' : 'This month'} color="blue" />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'رمز التحميل السريع' : 'Quick download QR'}</h3>
              </div>
              <div className="flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <a href={`https://wa.me/${ACADEMY_PHONE}`} target="_blank" rel="noopener noreferrer" className="block w-32 h-32 bg-white rounded-lg flex items-center justify-center border-4 border-emerald-500 hover:border-emerald-400 transition cursor-pointer">
                  <QrCode className="h-24 w-24 text-slate-900" />
                </a>
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-3">{isAr ? 'امسح الرمز بكاميرا هاتفك لتحميل التطبيق أو اضغط للتواصل عبر واتساب' : 'Scan the QR code with your phone camera to download the app or tap to contact via WhatsApp'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'واجهة برمجة التطبيقات (REST API)' : 'REST API'}</h3>
            <Badge color="emerald">{isAr ? 'مفعّل' : 'Active'}</Badge>
          </div>
          <div className="space-y-3">
            {[
              { method: 'GET', endpoint: '/api/v1/players', desc: isAr ? 'جلب قائمة جميع اللاعبين' : 'Fetch all players' },
              { method: 'GET', endpoint: '/api/v1/teams', desc: isAr ? 'جلب الفئات السنية' : 'Fetch age groups' },
              { method: 'POST', endpoint: '/api/v1/attendance', desc: isAr ? 'تسجيل حضور لاعب' : 'Record player attendance' },
              { method: 'GET', endpoint: '/api/v1/matches', desc: isAr ? 'جلب المباريات والنتائج' : 'Fetch matches and results' },
              { method: 'POST', endpoint: '/api/v1/subscriptions/pay', desc: isAr ? 'تسجيل دفعة اشتراك' : 'Record subscription payment' },
              { method: 'GET', endpoint: '/api/v1/reports/financial', desc: isAr ? 'التقارير المالية' : 'Financial reports' },
            ].map((api, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <Badge color={api.method === 'GET' ? 'blue' : 'emerald'}>{api.method}</Badge>
                <code className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1" dir="ltr">{api.endpoint}</code>
                <span className="text-[11px] text-slate-400">{api.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{isAr ? 'مفتاح API نشط' : 'API Key active'}: sk_live_shooter_****a3f9</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-3">
          {[
            { title: isAr ? 'إشعار غياب لاعب' : 'Player absence alert', desc: isAr ? 'تنبيه SMS تلقائي عند غياب اللاعب بدون عذر' : 'Automatic SMS alert when player is absent without excuse', icon: Bell, color: 'red', status: isAr ? 'مفعّل' : 'Active' },
            { title: isAr ? 'إشعار انتهاء الاشتراك' : 'Subscription expiry alert', desc: isAr ? 'تذكير قبل 3 أيام من انتهاء الاشتراك الشهري' : 'Reminder 3 days before monthly subscription expires', icon: MessageSquare, color: 'amber', status: isAr ? 'مفعّل' : 'Active' },
            { title: isAr ? 'تأكيد دفع اشتراك' : 'Payment confirmation', desc: isAr ? 'رسالة WhatsApp بإيصال الدفع بعد التسوية' : 'WhatsApp message with payment receipt after settlement', icon: Share2, color: 'emerald', status: isAr ? 'مفعّل' : 'Active' },
            { title: isAr ? 'نتيجة المباراة' : 'Match result', desc: isAr ? 'إشعار فوري بالنتيجة بعد كل مباراة' : 'Instant result notification after each match', icon: Bell, color: 'blue', status: isAr ? 'مفعّل' : 'Active' },
          ].map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-${n.color}-500`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{n.desc}</p>
                </div>
                <Badge color="emerald">{n.status}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
