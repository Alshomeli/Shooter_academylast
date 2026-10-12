import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { db, signIn, signUp, setRegistering } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { FormField, inputCls } from '@/components/ui';
import type { CurrentUser, Lang } from '@/types';

type Screen = 'login' | 'register' | 'forgot' | 'reset';
export function Login({ onLogin, lang, setLang, recovery = false, registrationEntry = false, staffRegistrationEntry = false }: {
  onLogin: (user: CurrentUser) => void; lang: Lang; setLang: (lang: Lang) => void; recovery?: boolean; registrationEntry?: boolean; staffRegistrationEntry?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>(recovery ? 'reset' : (registrationEntry || staffRegistrationEntry) ? 'register' : 'login');
  const [registrationKind, setRegistrationKind] = useState<'parent' | 'staff'>(staffRegistrationEntry ? 'staff' : 'parent');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (recovery) { setScreen('reset'); setError(''); setMessage(''); setPassword(''); setConfirm(''); }
  }, [recovery]);
  const ar = lang === 'ar';
  const text = (a: string, e: string) => ar ? a : e;
  const changeScreen = (next: Screen) => { setShowPassword(false); setShowConfirm(false); setScreen(next); setError(''); setMessage(''); setPassword(''); setConfirm(''); };
  const googleLogin = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
      });
      if (error) throw error;
    } catch {
      setError(text('تعذر الدخول عبر Google. حاول مجددًا أو استخدم البريد الإلكتروني.', 'Unable to sign in with Google. Try again or use your email.'));
    } finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage(''); setBusy(true); setRegistering(true);
    try {
      if (screen === 'register' || screen === 'reset') {
        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error(text('استخدم 10 أحرف على الأقل تتضمن حروفًا إنجليزية وأرقامًا.', 'Use at least 10 characters, including letters and numbers.'));
        }
        if (password !== confirm) throw new Error(text('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
      }
      if (screen === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage(text('إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.', 'If this email is registered, a password reset link will arrive shortly.'));
        return;
      }
      if (screen === 'register') {
        const staffFlow = registrationKind === 'staff';
        const { data, error } = await signUp(email.trim(), password, staffFlow ? 'staff-registration' : 'registration');
        if (error) throw error;
        if (!data.session) {
          setPassword(''); setConfirm('');
          setMessage(staffFlow
            ? text('راجع بريدك لتأكيد الحساب، ثم سجّل الدخول لإكمال طلب الموظف أو المدرب.', 'Check your email to confirm your account, then sign in to complete the staff or coach application.')
            : text('راجع بريدك لتأكيد الحساب، ثم سجّل الدخول لإكمال بيانات ولي الأمر والأبناء.', 'Check your email to confirm your account, then sign in to complete the parent and children application.'));
          return;
        }
      } else if (screen === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw new Error(text('تعذر الدخول. تحقق من البريد وكلمة المرور وتأكيد الحساب.', 'Unable to sign in. Check your email, password and email confirmation.'));
        // The selected portal is presentational only. Never change onboarding
        // metadata, staff role, or permissions as a side effect of signing in.
      }
      const member = await db.getCurrentUser();
      if (!member) throw new Error(text('تعذر تحميل حسابك. حاول مجددًا.', 'Could not load your account. Please try again.'));
      if (!member.registrationOnly && member.role !== 'parent') {
        await db.addLoginAuditLog({ id: '', action: 'login', details: 'Signed in', timestamp: '', userRole: '', userName: '' }).catch(console.error);
      }
      onLogin(member);
    } catch (e) {
      setError(e instanceof Error ? e.message : text('تعذر إتمام العملية. حاول مجددًا.', 'Unable to complete this action. Please try again.'));
    } finally { setRegistering(false); setBusy(false); }
  };
  const titles = {
    login: registrationKind === 'staff' ? text('دخول الموظف', 'Staff sign in') : text('دخول ولي الأمر', 'Parent sign in'), register: registrationKind === 'staff' ? text('حساب مدير / موظف / مدرب جديد', 'Create a manager / staff / coach account') : text('حساب ولي أمر جديد', 'Create a parent account'),
    forgot: text('استعادة كلمة المرور', 'Reset password'), reset: text('كلمة مرور جديدة', 'Choose a new password'),
  };
  return <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4" dir={ar ? 'rtl' : 'ltr'}>
    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl text-slate-900 dark:text-white">
      <div className="flex items-center justify-between mb-6">
        <img src="/شعار_أكاديمية_شوتر_ثلاثي_الأبعاد copy 2.png" alt={text('أكاديمية شوتر', 'Shooter Academy')} className="h-20 w-20 object-contain" />
        <button type="button" className="text-sm text-brand-600 font-bold" onClick={() => setLang(ar ? 'en' : 'ar')}>{ar ? 'English' : 'العربية'}</button>
      </div>
      <h1 className="text-2xl font-black mb-2">{text('أكاديمية شوتر', 'Shooter Academy')}</h1>
      <h2 className="font-bold mb-5 text-slate-500">{titles[screen]}</h2>
      {error && <p role="alert" className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{error}</p>}
      {message && <p role="status" className="mb-4 p-3 rounded-lg bg-brand-50 text-brand-800 text-sm">{message}</p>}
      {(screen === 'login' || screen === 'register') && <div className="mb-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={text('نوع البوابة', 'Portal type')}>
          <button type="button" disabled={busy} aria-pressed={registrationKind === 'parent'} onClick={() => setRegistrationKind('parent')} className={`rounded-lg border px-3 py-3 text-sm font-bold disabled:opacity-60 ${registrationKind === 'parent' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600'}`}>{text('ولي الأمر', 'Parent')}</button>
          <button type="button" disabled={busy} aria-pressed={registrationKind === 'staff'} onClick={() => setRegistrationKind('staff')} className={`rounded-lg border px-3 py-3 text-sm font-bold disabled:opacity-60 ${registrationKind === 'staff' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600'}`}>{text('الموظف', 'Staff')}</button>
        </div>
        {screen === 'login' && <p className="mt-2 text-xs text-slate-500">{text('اختيار البوابة لا يغيّر نوع حسابك أو صلاحياتك. سيتم توجيهك حسب دورك المعتمد.', 'Selecting a portal does not change your account or permissions. Access follows your approved role.')}</p>}
        {screen === 'register' && registrationKind === 'staff' && <p className="mt-2 text-xs text-slate-500">{text('يشمل الموظف: المدير والمدرب ومساعد المدرب ومدرب الحراس والاستقبال والمحاسب. جميعها طلبات تحتاج موافقة الإدارة.', 'Staff includes managers, coaches, assistant coaches, goalkeeper coaches, receptionists and accountants. All applications require management approval.')}</p>}
        {screen === 'register' && registrationKind === 'parent' && <p className="mt-2 text-xs text-slate-500">{text('يتم تسجيل اللاعب ضمن حساب ولي الأمر، دون حساب دخول مستقل.', 'Players are registered under the parent account, without a separate sign-in.')}</p>}
      </div>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          {screen !== 'reset' && <FormField label={text('البريد الإلكتروني', 'Email')}><input aria-label={text('البريد الإلكتروني', 'Email')} className={inputCls} type="email" dir="ltr" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></FormField>}
          {screen !== 'forgot' && <FormField label={text('كلمة المرور', 'Password')}><div className="relative"><input aria-label={text('كلمة المرور', 'Password')} className={`${inputCls} pe-12`} type={showPassword ? "text" : "password"} autoComplete={screen === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? text("إخفاء كلمة المرور", "Hide password") : text("إظهار كلمة المرور", "Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 end-2 flex items-center text-slate-500 hover:text-brand-600">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></FormField>}
          {(screen === 'register' || screen === 'reset') && <><p className="text-xs text-slate-500">{text('10 أحرف على الأقل، تتضمن حروفًا إنجليزية وأرقامًا.', 'At least 10 characters, including letters and numbers.')}</p><FormField label={text('تأكيد كلمة المرور', 'Confirm password')}><div className="relative"><input aria-label={text('تأكيد كلمة المرور', 'Confirm password')} className={`${inputCls} pe-12`} type={showConfirm ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /><button type="button" aria-label={showConfirm ? text("إخفاء تأكيد كلمة المرور", "Hide confirmation password") : text("إظهار تأكيد كلمة المرور", "Show confirmation password")} aria-pressed={showConfirm} onClick={() => setShowConfirm(v => !v)} className="absolute inset-y-0 end-2 flex items-center text-slate-500 hover:text-brand-600">{showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></FormField></>}
          <button className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg" type="submit">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}{titles[screen]}</button>
        </fieldset>
      </form>
      {(screen === 'login' || screen === 'register') && <button type="button" disabled={busy} onClick={() => void googleLogin()} className="mt-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">{text('المتابعة باستخدام Google', 'Continue with Google')}</button>}
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-brand-700 font-bold">
        {screen === 'login' ? <><button disabled={busy} onClick={() => { window.location.search = '?view=registration'; }}>{text('تسجيل ولي أمر وأبنائه', 'Register parent and children')}</button><button disabled={busy} onClick={() => { window.location.search = '?view=staff-registration'; }}>{text('طلب مدير / موظف / مدرب', 'Manager / staff / coach application')}</button><button disabled={busy} onClick={() => changeScreen('forgot')}>{text('نسيت كلمة المرور؟', 'Forgot password?')}</button></> : screen !== 'reset' && <button disabled={busy} onClick={() => changeScreen('login')}>{text('العودة للدخول', 'Back to sign in')}</button>}
      </div>
      {screen === 'register' && <p className="mt-4 text-xs text-slate-500">{registrationKind === 'staff'
        ? text('تراجع الإدارة طلب الموظف أو المدرب ويمكنها الموافقة أو الرفض أو إعادته للتعديل قبل تفعيل أي صلاحية.', 'The academy reviews staff applications and may approve, reject, or request changes before any staff access is activated.')
        : text('تراجع الإدارة طلب تسجيل الأبناء قبل تفعيلهم.', 'The academy reviews children’s applications before activation.')}</p>}
    </div>
  </main>;
}

