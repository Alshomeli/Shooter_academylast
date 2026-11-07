import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardCheck, Loader2, LogOut, Send } from 'lucide-react';
import { FormField, inputCls } from '@/components/ui';
import { getMyStaffApplication, saveStaffApplication, submitStaffApplication } from '@/lib/staff-registration';
import type { CurrentUser, Lang, StaffApplication } from '@/types';

export function StaffRegistration({ user, lang, onLogout, onApproved }: {
  user: CurrentUser;
  lang: Lang;
  onLogout: () => Promise<void>;
  onApproved: () => Promise<void>;
}) {
  const ar = lang === 'ar';
  const text = (a: string, e: string) => ar ? a : e;
  const [app, setApp] = useState<StaffApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    requestedRole: 'coach' as StaffApplication['requestedRole'],
    fullName: '',
    phone: '',
    nationalId: '',
    specialization: '',
    experienceYears: '',
    licenses: '',
    applicantNotes: '',
  });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const current = await getMyStaffApplication();
      setApp(current);
      if (current && ['draft', 'needs_info', 'rejected'].includes(current.status)) {
        setForm({
          requestedRole: current.requestedRole,
          fullName: current.fullName,
          phone: current.phone,
          nationalId: current.nationalId,
          specialization: current.specialization,
          experienceYears: current.experienceYears == null ? '' : String(current.experienceYears),
          licenses: current.licenses.join(', '),
          applicantNotes: current.applicantNotes,
        });
      }
      if (current?.status === 'approved') await onApproved();
    } catch {
      setError(text('تعذر تحميل طلبك.', 'Could not load your application.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const saved = await saveStaffApplication({
        requestedRole: form.requestedRole,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        nationalId: form.nationalId.trim(),
        specialization: form.specialization.trim(),
        experienceYears: form.experienceYears === '' ? null : Number(form.experienceYears),
        licenses: form.licenses.split(',').map(x => x.trim()).filter(Boolean),
        applicantNotes: form.applicantNotes.trim(),
      });
      const submitted = await submitStaffApplication(saved.id);
      setApp(submitted);
    } catch (err) {
      setError(err instanceof Error ? err.message : text('تعذر إرسال الطلب.', 'Could not submit the application.'));
    } finally { setBusy(false); }
  };

  const editable = !app || ['draft', 'needs_info', 'rejected'].includes(app.status);
  const statusText = app?.status === 'pending'
    ? text('طلبك قيد مراجعة المدير.', 'Your application is awaiting manager review.')
    : app?.status === 'needs_info'
      ? text('طلبك يحتاج تعديل قبل إعادة الإرسال.', 'Your application needs changes before resubmission.')
      : app?.status === 'rejected'
        ? text('تم رفض الطلب. يمكنك تعديل البيانات وإرسال طلب جديد.', 'The application was rejected. You may edit the data and submit again.')
        : '';

  return (
    <main className="min-h-screen bg-slate-950 p-4 sm:p-8" dir={ar ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:text-white">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black">{text('طلب انضمام مدير / موظف / مدرب', 'Manager / staff / coach application')}</h1>
            <p className="mt-1 text-sm text-slate-500">{text('أدخل بياناتك أنت. لن يتم تفعيل أي صلاحية موظف أو مدير قبل موافقة مدير نشط موجود مسبقًا.', 'Enter your own details. No staff permissions are activated before manager approval. Approval must come from an existing active manager.')}</p>
          </div>
          <button onClick={() => void onLogout()} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
            <LogOut className="h-4 w-4" /> {text('خروج', 'Sign out')}
          </button>
        </div>

        {loading ? <div className="py-12 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-600" /></div> : (
          <>
            {statusText && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{statusText}</div>}
            {app?.reviewNotes && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><b>{text('ملاحظة المدير:', 'Manager note:')}</b> {app.reviewNotes}</div>}
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {editable ? (
              <form onSubmit={submit} className="space-y-4">
                <FormField label={text('الصفة المطلوبة', 'Requested role')}>
                  <select className={inputCls} value={form.requestedRole} onChange={e => setForm({ ...form, requestedRole: e.target.value as StaffApplication['requestedRole'] })}>
                    <option value="manager">{text('مدير', 'Manager')}</option>
                    <option value="coach">{text('مدرب', 'Coach')}</option>
                    <option value="accountant">{text('محاسب', 'Accountant')}</option>
                    <option value="receptionist">{text('استقبال', 'Receptionist')}</option>
                  </select>
                </FormField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label={text('الاسم بالكامل', 'Full name')}><input className={inputCls} required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></FormField>
                  <FormField label={text('البريد الإلكتروني', 'Email')}><input className={inputCls} disabled value={user.email} dir="ltr" /></FormField>
                  <FormField label={text('رقم الهاتف', 'Phone')}><input className={inputCls} required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" /></FormField>
                  <FormField label={text('الرقم الشخصي', 'National ID')}><input className={inputCls} value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} dir="ltr" /></FormField>
                  <FormField label={text('التخصص', 'Specialization')}><input className={inputCls} value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} /></FormField>
                  <FormField label={text('سنوات الخبرة', 'Years of experience')}><input className={inputCls} type="number" min={0} value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value })} /></FormField>
                </div>
                <FormField label={text('الشهادات / التراخيص (افصل بينها بفاصلة)', 'Certificates / licenses (comma separated)')}><input className={inputCls} value={form.licenses} onChange={e => setForm({ ...form, licenses: e.target.value })} /></FormField>
                <FormField label={text('ملاحظات إضافية', 'Additional notes')}><textarea className={inputCls} rows={3} value={form.applicantNotes} onChange={e => setForm({ ...form, applicantNotes: e.target.value })} /></FormField>
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-60">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {app?.status === 'needs_info' ? text('حفظ وإعادة الإرسال', 'Save and resubmit') : text('إرسال للمدير للمراجعة', 'Submit for manager review')}
                </button>
              </form>
            ) : (
              <div className="py-8 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-emerald-600" />
                <p className="mt-3 font-bold">{statusText || text('تم استلام الطلب.', 'Application received.')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
