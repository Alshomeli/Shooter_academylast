import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import type { CurrentUser, Lang } from '@/types';

export function OnboardingChoice({ lang, onSelected, onLogout }: {
  lang: Lang; onSelected: (user: CurrentUser) => void; onLogout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ar = lang === 'ar';
  const choose = async (mode: 'parent' | 'staff') => {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const { error } = await supabase.auth.updateUser({ data: { onboarding_mode: mode } });
      if (error) throw error;
      const member = await db.getCurrentUser();
      if (!member) throw new Error('Account unavailable');
      onSelected(member);
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-950 p-4 flex items-center justify-center" dir={ar ? 'rtl' : 'ltr'}>
    <section className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900">
      <h1 className="text-xl font-black mb-3">{ar ? 'اختر نوع طلب التسجيل' : 'Choose your application type'}</h1>
      <p className="text-sm mb-5">{ar ? 'اختيار نوع الطلب لا يمنح صلاحيات. تراجع الإدارة الطلب قبل التفعيل.' : 'Choosing an application does not grant access. Management reviews applications before activation.'}</p>
      {error && <p role="alert">{ar ? 'تعذر حفظ الاختيار. حاول مجددًا.' : 'Could not save your choice. Please retry.'}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button disabled={busy} onClick={() => void choose('parent')} className="rounded-xl bg-brand-600 p-3 text-white disabled:opacity-50">{ar ? 'ولي أمر' : 'Parent'}</button>
        <button disabled={busy} onClick={() => void choose('staff')} className="rounded-xl bg-brand-600 p-3 text-white disabled:opacity-50">{ar ? 'موظف / مدرب' : 'Staff / coach'}</button>
      </div>
      <button disabled={busy} onClick={onLogout} className="mt-5">{ar ? 'تسجيل الخروج' : 'Sign out'}</button>
    </section>
  </main>;
}
