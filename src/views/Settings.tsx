import { useState, type FormEvent } from 'react';
import {
  Settings as SettingsIcon, Save, Building2, Phone, Mail, MapPin,
  DollarSign, Calendar, Target, Info,
} from 'lucide-react';
import type { Settings, Staff, Lang, Role } from '@/types';
import { PageHeader } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface SettingsProps {
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  activeRole: Role;
  lang: Lang;
}

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white';

function isImageLogo(value: string) {
  return /^(https?:\/\/|data:image\/|\/)/i.test(value.trim());
}

export function SettingsView({ settings, onSettingsChange, activeRole, lang }: SettingsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [form, setForm] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  /* --------------------------- Access control --------------------------- */
  if (activeRole !== 'manager') {
    return (
      <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
        <PageHeader
          title={t.settings}
          subtitle={isAr ? 'تهيئة الإعدادات العامة للأكاديمية والرسوم المعتمدة' : 'Configure general academy settings and approved fees'}
        />
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-500 mb-4">
            <Info className="h-8 w-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
            {t.insufficientPermissions}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isAr ? 'هذه الصفحة متاحة فقط لمدير النظام. يرجى التواصل مع الإدارة للوصول إلى إعدادات الأكاديمية.' : 'This page is only available to the system manager. Please contact administration to access academy settings.'}
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------ Handlers ------------------------------ */
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; setSaving(true); setSaveError('');
    try {
      await onSettingsChange(form);
      setForm({ ...form, version: (form.version ?? 0) + 1 });
      setSaved(true); window.setTimeout(() => setSaved(false), 2600);
    } catch { setSaveError(isAr ? 'تعذر حفظ الإعدادات. حدّث الصفحة وحاول مجددًا.' : 'Could not save settings. Refresh and retry.'); }
    finally { setSaving(false); }
  };

  /* ------------------------------- Render ------------------------------- */
  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t.settings}
        subtitle={isAr ? 'تهيئة الإعدادات العامة للأكاديمية والرسوم المعتمدة' : 'Configure general academy settings and approved fees'}
      />

      {saveError && <p role="alert" className="text-red-600">{saveError}</p>}
      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
      >
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 mb-7">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Target className="h-5 w-5" />
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p className="font-black text-slate-700 dark:text-slate-200 mb-0.5 flex items-center gap-1.5">
              <SettingsIcon className="h-3.5 w-3.5" />
              {isAr ? 'ملاحظات حول الإعدادات' : 'Notes about settings'}
            </p>
            {isAr ? 'يتم تطبيق هذه الإعدادات على كافة أنحاء النظام بما في ذلك الفواتير، التقارير، وقوائم اللاعبين. تأكد من صحة البيانات قبل الحفظ.' : 'These settings apply across the entire system including invoices, reports, and player lists. Verify data before saving.'}
          </div>
        </div>

        {/* ---------------------- Section 1: Identity ---------------------- */}
        <SectionHeader
          icon={<Building2 className="h-5 w-5" />}
          color="emerald"
          title={isAr ? 'هوية الأكاديمية' : 'Academy Identity'}
          subtitle={isAr ? 'الاسم والشعار وبيانات التواصل' : 'Name, logo and contact info'}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Logo + Name (full row) */}
          <div className="md:col-span-2 flex items-end gap-3">
            <div className="shrink-0">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? 'الشعار' : 'Logo'}
              </label>
              <div className="w-14 h-14 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-2xl overflow-hidden">
                {form.logoUrl && isImageLogo(form.logoUrl)
                  ? <img src={form.logoUrl} alt={isAr ? 'شعار الأكاديمية' : 'Academy logo'} className="w-full h-full object-contain p-1" />
                  : <span>{form.logoUrl || '⚽'}</span>}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? 'اسم الأكاديمية' : 'Academy name'}
              </label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputCls}
                placeholder={isAr ? 'أكاديمية ...' : 'Academy...'}
                required
              />
            </div>
            <div className="w-28 shrink-0">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? 'الشعار' : 'Logo'}
              </label>
              <input
                value={form.logoUrl}
                onChange={(e) => set('logoUrl', e.target.value)}
                className={inputCls}
                placeholder={isAr ? '/logo.png أو رابط صورة أو رمز' : '/logo.png, image URL, or emoji'}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {isAr ? 'يمكن استخدام مسار صورة داخل المشروع أو رابط صورة مباشر أو رمز.' : 'Use a project image path, direct image URL, or emoji.'}
              </p>
            </div>
          </div>

          <Field icon={<Phone className="h-3.5 w-3.5" />} label={t.phone}>
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
              dir="ltr"
              placeholder="+973 ..."
            />
          </Field>

          <Field icon={<Mail className="h-3.5 w-3.5" />} label={t.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              dir="ltr"
              placeholder="info@academy.com"
            />
          </Field>

          <div className="md:col-span-2">
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label={t.address}>
              <input
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                className={inputCls}
                placeholder={isAr ? 'المملكة، المدينة، الشارع' : 'Country, city, street'}
              />
            </Field>
          </div>
        </div>

        {/* ---------------------- Section 2: Fees -------------------------- */}
        <SectionHeader
          icon={<DollarSign className="h-5 w-5" />}
          color="amber"
          title={isAr ? 'رسوم الاشتراك' : 'Subscription fees'}
          subtitle={isAr ? 'القيم الافتراضية المعتمدة للخطط' : 'Default approved plan values'}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
          <FeeField
            label={t.monthly}
            value={form.subscriptionFeeMonthly}
            onChange={(v) => set('subscriptionFeeMonthly', v)}
            currency={t.currency}
          />
          <FeeField
            label={t.quarterly}
            value={form.subscriptionFeeQuarterly}
            onChange={(v) => set('subscriptionFeeQuarterly', v)}
            currency={t.currency}
          />
          <FeeField
            label={t.semiAnnual}
            value={form.subscriptionFeeSemiAnnual ?? 0}
            onChange={(v) => set('subscriptionFeeSemiAnnual', v)}
            currency={t.currency}
          />
          <FeeField
            label={t.yearly}
            value={form.subscriptionFeeYearly}
            onChange={(v) => set('subscriptionFeeYearly', v)}
            currency={t.currency}
          />
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-7">
          <Calendar className="h-3.5 w-3.5" />
          {isAr ? 'تُحتسب هذه الرسوم لكل لاعب وفق الفترة الزمنية المحددة للخطة.' : 'These fees are charged per player according to the plan period.'}
        </p>

        <SectionHeader
          icon={<DollarSign className="h-5 w-5" />}
          color="emerald"
          title={isAr ? 'الدفع عبر Benefit / IBAN' : 'Benefit / IBAN payments'}
          subtitle={isAr ? 'البيانات التي ستظهر لولي الأمر عند دفع الاشتراك' : 'Transfer details shown to parents when paying subscriptions'}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Field label={isAr ? 'رقم IBAN' : 'IBAN'}>
            <input value={form.benefitIban ?? ''} onChange={(e)=>set('benefitIban',e.target.value.replace(/\s+/g,'').toUpperCase())} className={inputCls} dir="ltr" placeholder="BH..." />
          </Field>
          <Field label={isAr ? 'اسم صاحب الحساب' : 'Account name'}>
            <input value={form.benefitAccountName ?? ''} onChange={(e)=>set('benefitAccountName',e.target.value)} className={inputCls} />
          </Field>
          <Field label={isAr ? 'تعليمات الدفع بالعربية' : 'Arabic payment instructions'}>
            <textarea value={form.paymentInstructionsAr ?? ''} onChange={(e)=>set('paymentInstructionsAr',e.target.value)} className={inputCls} rows={3} />
          </Field>
          <Field label={isAr ? 'تعليمات الدفع بالإنجليزية' : 'English payment instructions'}>
            <textarea value={form.paymentInstructionsEn ?? ''} onChange={(e)=>set('paymentInstructionsEn',e.target.value)} className={inputCls} rows={3} dir="ltr" />
          </Field>
        </div>

        {/* ---------------------------- Actions ---------------------------- */}
        <div className="flex justify-end pt-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit" disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {t.save}
          </button>
        </div>
      </form>

      {/* ----------------------- Success toast ----------------------- */}
      {saved && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2.5 px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-2xl shadow-emerald-900/20 animate-fadeIn"
          role="status"
          aria-live="polite"
        >
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Save className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold">{t.settingsSaved}</span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Sub-components ----------------------------- */

function SectionHeader({
  icon,
  color,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  color: 'emerald' | 'amber';
  title: string;
  subtitle?: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div className="shrink-0">
        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function FeeField({
  label,
  value,
  onChange,
  currency,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  currency: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={0.5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`${inputCls} pl-12`}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
          {currency}
        </span>
      </div>
    </div>
  );
}

/* Keep Staff referenced for the type import contract enforced by the app. */
export type _StaffRef = Staff;
