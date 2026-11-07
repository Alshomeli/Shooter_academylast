import { useEffect, useState } from 'react';
import { Send, Copy, CheckCircle2, Unplug } from 'lucide-react';
import { db } from '@/lib/store';
import type { Lang } from '@/types';

type Connection = { telegram_user_code: string; role: string; linked_at: string; last_seen_at: string; is_active: boolean };

export function TelegramLinkCard({ lang }: { lang: Lang }) {
  const isAr = lang === 'ar';
  const [code, setCode] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try { setConnection(await db.getTelegramConnection()); } catch { setConnection(null); }
  };
  useEffect(() => { void refresh(); }, []);

  const generate = async () => {
    setBusy(true); setError(''); setCopied(false);
    try { setCode(await db.createTelegramLinkCode()); }
    catch { setError(isAr ? 'تعذر إنشاء رمز الربط لهذا الحساب.' : 'Could not create a link code for this account.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
  };
  const disconnect = async () => {
    if (!confirm(isAr ? 'هل تريد فصل Telegram عن حسابك؟ ستحتاج رمز ربط جديد لإعادة الاتصال.' : 'Disconnect Telegram? You will need a new link code to reconnect.')) return;
    setBusy(true); setError('');
    try { await db.disconnectTelegram(); setConnection(null); setCode(''); }
    catch { setError(isAr ? 'تعذر فصل Telegram الآن.' : 'Could not disconnect Telegram.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/20 p-4">
      <div className="flex items-start gap-3">
        <Send className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm">{isAr ? 'Telegram التشغيلي' : 'Operations Telegram'}</p>
          {connection?.is_active ? (
            <>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 font-bold">{isAr ? '● متصل' : '● Connected'}</span>
                <code className="rounded-full bg-white dark:bg-slate-900 border px-2.5 py-1">{connection.telegram_user_code}</code>
                <span className="text-slate-500 px-1 py-1">{isAr ? (connection.role === 'manager' ? 'مدير' : 'مدرب') : connection.role}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{isAr ? 'آخر استخدام:' : 'Last used:'} {new Date(connection.last_seen_at).toLocaleString(isAr ? 'ar-BH' : 'en-BH')}</p>
              <button disabled={busy} onClick={disconnect} className="mt-3 rounded-xl border border-red-200 text-red-700 px-3 py-2 text-xs font-bold flex items-center gap-1">
                <Unplug className="h-4 w-4" />{isAr ? 'فصل Telegram' : 'Disconnect Telegram'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500 mt-1">{isAr ? 'اربط حساب المدير أو المدرب بالبوت. الرمز صالح 10 دقائق ولمرة واحدة.' : 'Connect a manager or coach account to the bot. The code is valid for 10 minutes and one use.'}</p>
              {!code ? (
                <button disabled={busy} onClick={generate} className="mt-3 rounded-xl bg-sky-600 text-white px-4 py-2 text-xs font-bold disabled:opacity-50">
                  {busy ? (isAr ? 'جارٍ الإنشاء...' : 'Generating...') : (isAr ? 'إنشاء رمز الربط' : 'Generate link code')}
                </button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-xl bg-white dark:bg-slate-900 border px-3 py-2 font-black tracking-widest">/link {code}</code>
                  <button onClick={copy} className="rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-1">
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
                  </button>
                  <button onClick={generate} disabled={busy} className="text-xs underline text-slate-500">{isAr ? 'رمز جديد' : 'New code'}</button>
                </div>
              )}
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
