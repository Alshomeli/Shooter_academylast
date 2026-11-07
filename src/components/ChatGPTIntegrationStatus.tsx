import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { Lang } from '@/types';

interface Props {
  lang: Lang;
}

type CheckState = 'loading' | 'ready' | 'blocked' | 'error';

const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

export function ChatGPTIntegrationStatus({ lang }: Props) {
  const ar = lang === 'ar';
  const [mcp, setMcp] = useState<CheckState>('loading');
  const [oauth, setOauth] = useState<CheckState>('loading');
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (!baseUrl) {
      setMcp('error');
      setOauth('error');
      return;
    }
    setChecking(true);
    setMcp('loading');
    setOauth('loading');

    try {
      const health = await fetch(`${baseUrl}/functions/v1/chatgpt-mcp/health`, { cache: 'no-store' });
      setMcp(health.ok ? 'ready' : 'error');
    } catch {
      setMcp('error');
    }

    try {
      const discovery = await fetch(`${baseUrl}/.well-known/oauth-authorization-server/auth/v1`, { cache: 'no-store' });
      if (discovery.ok) {
        setOauth('ready');
      } else {
        const body = await discovery.json().catch(() => ({}));
        setOauth(body?.error_code === 'feature_disabled' ? 'blocked' : 'error');
      }
    } catch {
      setOauth('error');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const mcpReady = mcp === 'ready';
  const oauthReady = oauth === 'ready';
  const fullyReady = mcpReady && oauthReady;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fullyReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {ar ? 'حالة ربط ChatGPT' : 'ChatGPT integration status'}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {fullyReady
                ? (ar ? 'بوابة MCP وOAuth جاهزتان للاتصال.' : 'MCP and OAuth are ready for connection.')
                : (ar ? 'البنية جاهزة جزئيًا؛ راجع الحالة أدناه.' : 'The integration is partially ready; review the checks below.')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-black text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {ar ? 'فحص' : 'Check'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatusRow
          label={ar ? 'خادم MCP' : 'MCP server'}
          state={mcp}
          readyText={ar ? 'نشط وجاهز' : 'Active and ready'}
          blockedText={ar ? 'غير متاح' : 'Unavailable'}
          errorText={ar ? 'تعذر التحقق' : 'Check failed'}
        />
        <StatusRow
          label={ar ? 'Supabase OAuth 2.1' : 'Supabase OAuth 2.1'}
          state={oauth}
          readyText={ar ? 'مفعّل' : 'Enabled'}
          blockedText={ar ? 'غير مفعّل في إعدادات المشروع' : 'Disabled in project settings'}
          errorText={ar ? 'تعذر التحقق' : 'Check failed'}
        />
      </div>

      {oauth === 'blocked' && (
        <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-[11px] text-amber-800 dark:text-amber-300">
          {ar
            ? 'المتبقي للربط الخارجي: تفعيل OAuth 2.1 Server من Supabase Authentication → OAuth Server. لا يتم تنفيذ أي تعديل إداري قبل المعاينة والتأكيد الصريح.'
            : 'Remaining external-connection step: enable OAuth 2.1 Server in Supabase Authentication → OAuth Server. Administrative writes still require preview and explicit confirmation.'}
        </div>
      )}
    </section>
  );
}

function StatusRow({
  label,
  state,
  readyText,
  blockedText,
  errorText,
}: {
  label: string;
  state: CheckState;
  readyText: string;
  blockedText: string;
  errorText: string;
}) {
  const loading = state === 'loading';
  const ready = state === 'ready';
  const text = loading ? '…' : ready ? readyText : state === 'blocked' ? blockedText : errorText;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-3">
      <span className="text-xs font-black text-slate-700 dark:text-slate-200">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black ${ready ? 'text-emerald-600' : loading ? 'text-slate-400' : 'text-amber-600'}`}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {text}
      </span>
    </div>
  );
}
