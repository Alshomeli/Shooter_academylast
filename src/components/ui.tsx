import { useState, type ReactNode } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  closeDisabled?: boolean;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, closeDisabled = false, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" onClick={closeDisabled ? undefined : onClose} />
      <div className={`relative w-full ${sizes[size]} max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn`}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close / إغلاق"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-wait"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'emerald' | 'slate' | 'amber';
}

export function Badge({ children, color = 'gray' }: BadgeProps) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[color]}`}>
      {children}
    </span>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, sublabel, color = 'emerald', onClick }: StatCardProps) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-violet-500 to-violet-600',
    slate: 'from-slate-600 to-slate-700',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all text-right w-full ${onClick ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
          {sublabel && <p className="text-[11px] text-slate-400 mt-1 font-semibold">{sublabel}</p>}
        </div>
        <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </Comp>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const confirm = async () => {
    if (busy) return; setBusy(true); setError('');
    try { await onConfirm(); onClose(); }
    catch { setError(document.documentElement.lang === 'ar' ? 'تعذر حفظ التغيير. حاول مجددًا.' : 'Could not save the change. Please try again.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-fadeIn">
        <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">{message}</p>
        <div role="alert" className="text-sm text-red-600 mb-3">{error}</div>
        <div className="flex gap-2 justify-end">
          <button disabled={busy} onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
            {cancelLabel}
          </button>
          <button disabled={busy} onClick={() => void confirm()} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition cursor-pointer">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Form helpers ---------- */

export const inputCls = 'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white';

export function FormField({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-500 animate-fadeIn">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold animate-fadeIn">
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

interface SaveButtonProps {
  loading: boolean;
  children: ReactNode;
  disabled?: boolean;
}

export function SaveButton({ loading, children, disabled }: SaveButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? 'Saving...' : children}
    </button>
  );
}

/* ---------- Loading skeleton ---------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl ${className}`} />;
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-16 mb-2" />
          <Skeleton className="h-2 w-24" />
        </div>
      ))}
    </div>
  );
}
