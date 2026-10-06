import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { db, prefs } from '@/lib/store';
import type { CurrentUser, Lang } from '@/types';

type AuthDetails = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  scope?: string;
  client?: { name?: string };
};

const authBaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') + '/auth/v1';
const authApiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function oauthRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Missing authenticated session');

  const response = await fetch(authBaseUrl + path, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': authApiKey,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.error_description === 'string'
        ? data.error_description
        : typeof data?.error === 'string'
          ? data.error
          : `OAuth request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function OAuthConsent() {
  const [lang] = useState<Lang>(() => prefs.getLang());
  const ar = lang === 'ar';
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [member, setMember] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const authorizationId = useMemo(
    () => new URLSearchParams(window.location.search).get('authorization_id'),
    [],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!authorizationId) {
        setError(ar ? 'طلب التفويض غير مكتمل.' : 'Missing authorization request.');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        const target = window.location.pathname + window.location.search;
        window.location.replace('/?oauth_return=' + encodeURIComponent(target));
        return;
      }

      const currentMember = await db.getCurrentUser().catch(() => null);
      if (!active) return;
      setMember(currentMember);

      const authData = await oauthRequest<AuthDetails>(`/oauth/authorizations/${encodeURIComponent(authorizationId)}`);
      if (!active) return;
      if (authData.redirect_url && !authData.authorization_id) {
        window.location.replace(authData.redirect_url);
        return;
      }

      setDetails(authData);
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [authorizationId, ar]);

  const allowed = Boolean(member && !member.registrationOnly && member.role !== 'parent');

  const decide = async (approve: boolean) => {
    if (!authorizationId || busy) return;
    setBusy(true); setError('');
    try {
      const result = await oauthRequest<{ redirect_url?: string }>(
        `/oauth/authorizations/${encodeURIComponent(authorizationId)}/consent`,
        {
          method: 'POST',
          body: JSON.stringify({ action: approve ? 'approve' : 'deny' }),
        },
      );
      if (!result.redirect_url) throw new Error('Missing OAuth redirect URL');
      window.location.replace(result.redirect_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : (ar ? 'تعذر إكمال التفويض.' : 'Unable to complete authorization.'));
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></main>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4" dir={ar ? 'rtl' : 'ltr'}>
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl text-slate-900">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-red-700 text-white flex items-center justify-center"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-black">{ar ? 'تفويض تكامل ChatGPT' : 'Authorize ChatGPT integration'}</h1>
            <p className="text-xs text-slate-500 mt-1">{ar ? 'أكاديمية شوتر — وصول إداري آمن' : 'Shooter Academy — secure administrative access'}</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 flex gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}

        {!allowed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-black text-amber-800">{ar ? 'هذا التكامل مخصص لموظفي الأكاديمية المصرح لهم فقط.' : 'This integration is only available to authorized academy staff.'}</p>
            <button onClick={() => void decide(false)} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <XCircle className="h-4 w-4" /> {ar ? 'رفض الطلب' : 'Deny request'}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p><span className="font-bold">{ar ? 'التطبيق:' : 'Application:'}</span> {details?.client?.name || 'ChatGPT'}</p>
              <p><span className="font-bold">{ar ? 'الحساب:' : 'Account:'}</span> {member?.name}</p>
              <p><span className="font-bold">{ar ? 'الدور:' : 'Role:'}</span> {member?.role}</p>
              {details?.redirect_uri && <p className="break-all"><span className="font-bold">{ar ? 'وجهة العودة:' : 'Redirect:'}</span> {details.redirect_uri}</p>}
              {details?.scope?.trim() && (
                <div>
                  <p className="font-bold mb-2">{ar ? 'الصلاحيات المطلوبة:' : 'Requested scopes:'}</p>
                  <div className="flex flex-wrap gap-2">{details.scope.split(' ').filter(Boolean).map(scope => <span key={scope} className="rounded-full bg-white border px-2.5 py-1 text-xs font-bold">{scope}</span>)}</div>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
              {ar ? 'يستخدم التكامل صلاحيات حسابك الحالية فقط. أي تعديل إداري يظل خاضعًا للمعاينة والتأكيد الصريح داخل بوابة العمليات.' : 'The integration uses only your existing account permissions. Administrative changes still require preview and explicit confirmation through the operations gateway.'}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => void decide(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {ar ? 'السماح' : 'Allow'}
              </button>
              <button onClick={() => void decide(false)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> {ar ? 'رفض' : 'Deny'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
