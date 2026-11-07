import { useEffect, useState } from 'react';
import {
  ShieldCheck, CheckCircle, XCircle, Clock, UserPlus, Search, AlertCircle, Loader2,
} from 'lucide-react';
import type { Player, Staff, Lang, Role, Team, StaffApplication } from '@/types';
import { Badge, PageHeader, EmptyState, ConfirmDialog } from '@/components/ui';
import { tr, roleLabel } from '@/lib/i18n';
import { approveStaffApplication, getStaffApplications, reviewStaffApplication } from '@/lib/staff-registration';

interface ApprovalsProps {
  players: Player[];
  teams: Team[];
  onRefresh: () => Promise<void>;
  staff: Staff[];
  onPlayersChange: (p: Player[]) => void;
  onStaffChange: (s: Staff[]) => void;
  activeRole: Role;
  lang: Lang;
}

export function Approvals({ staff, onStaffChange, onRefresh, activeRole, lang }: ApprovalsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const isRtl = isAr;
  const [filter, setFilter] = useState<'pending' | 'active' | 'inactive' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [applicationError, setApplicationError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ id: string; action: 'needs_info' | 'rejected' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const loadApplications = async () => {
    if (activeRole !== 'manager') return;
    try { setApplications(await getStaffApplications()); setApplicationError(''); }
    catch { setApplicationError(isAr ? 'تعذر تحميل طلبات الانضمام.' : 'Could not load staff applications.'); }
  };

  useEffect(() => {
    void loadApplications();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void loadApplications(); };
    const timer = setInterval(refreshVisible, 60000);
    window.addEventListener('focus', refreshVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshVisible); };
  }, [activeRole, lang]);

  if (activeRole !== 'manager') {
    return (
      <div className="space-y-5 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
        <PageHeader title={t.approvals} />
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {isAr ? t.managerOnly : 'This page is available to managers only'}
          </p>
        </div>
      </div>
    );
  }

  const pendingStaff = staff.filter((s) => s.status === 'pending');
  const activeStaff = staff.filter((s) => s.status === 'active');
  const inactiveStaff = staff.filter((s) => s.status === 'inactive');

  const filtered = staff.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleConfirm = async () => {
    if (!actionTarget || processingId) return;
    setProcessingId(actionTarget.id);
    try {
      const updated = staff.map((s) => {
        if (s.id !== actionTarget.id) return s;
        return { ...s, status: actionTarget.action === 'approve' ? 'active' as const : 'inactive' as const };
      });
      await onStaffChange(updated);
      setActionTarget(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApplicationApproval = async (id: string) => {
    if (processingId) return;
    setProcessingId(id); setApplicationError('');
    try {
      await approveStaffApplication(id);
      await Promise.all([loadApplications(), onRefresh()]);
    } catch {
      setApplicationError(isAr ? 'تعذر اعتماد الطلب.' : 'Could not approve the application.');
    } finally { setProcessingId(null); }
  };

  const handleApplicationReview = async () => {
    if (!reviewTarget || processingId) return;
    if (!reviewNotes.trim()) {
      setApplicationError(reviewTarget.action === 'needs_info'
        ? (isAr ? 'اكتب ملاحظة توضّح التعديل المطلوب.' : 'Add a note describing the requested change.')
        : (isAr ? 'اكتب سبب الرفض قبل التأكيد.' : 'Add the rejection reason before confirming.'));
      return;
    }
    setProcessingId(reviewTarget.id); setApplicationError('');
    try {
      await reviewStaffApplication(reviewTarget.id, reviewTarget.action, reviewNotes.trim());
      setReviewTarget(null); setReviewNotes('');
      await loadApplications();
    } catch {
      setApplicationError(isAr ? 'تعذر تحديث الطلب.' : 'Could not update the application.');
    } finally { setProcessingId(null); }
  };

  const staffApplicationStatus = (status: StaffApplication['status']) => {
    const labels: Record<StaffApplication['status'], string> = {
      draft: isAr ? 'مسودة' : 'Draft',
      pending: isAr ? 'بانتظار المراجعة' : 'Pending review',
      needs_info: isAr ? 'يحتاج تعديل' : 'Needs changes',
      approved: isAr ? 'مقبول' : 'Approved',
      rejected: isAr ? 'مرفوض' : 'Rejected',
    };
    return labels[status];
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge color="amber"><Clock className="h-3 w-3" /> {t.pending}</Badge>;
    if (status === 'active') return <Badge color="emerald"><CheckCircle className="h-3 w-3" /> {t.active}</Badge>;
    return <Badge color="red"><XCircle className="h-3 w-3" /> {t.inactive}</Badge>;
  };

  return (
    <div className="space-y-5 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'الموافقات' : 'Approvals'}
        subtitle={isAr ? 'مراجعة وقبول حسابات الموظفين الجدد' : 'Review and approve new staff accounts'}
      />

      {applicationError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{applicationError}</p>}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">{isAr ? 'طلبات الموظفين والمدربين' : 'Staff and coach applications'}</h3>
          <p className="text-xs text-slate-500">{isAr ? 'المتقدم يدخل بياناته بنفسه، والمدير يعتمد أو يرفض أو يعيد الطلب للتعديل.' : 'Applicants enter their own data; the manager approves, rejects, or requests changes.'}</p>
        </div>
        {applications.filter(a => a.status !== 'draft').length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{isAr ? 'لا توجد طلبات موظفين حالياً.' : 'No staff applications yet.'}</div>
        ) : applications.filter(a => a.status !== 'draft').map(app => (
          <div key={app.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-900 dark:text-white">{app.fullName}</p>
                  <Badge color={app.status === 'approved' ? 'emerald' : app.status === 'rejected' ? 'red' : app.status === 'needs_info' ? 'amber' : 'blue'}>{staffApplicationStatus(app.status)}</Badge>
                  <Badge color="blue">{roleLabel(app.requestedRole, lang)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:grid-cols-2">
                  <p><b>{isAr ? 'البريد الإلكتروني:' : 'Email:'}</b> <span dir="ltr">{app.email}</span></p>
                  <p><b>{isAr ? 'رقم الهاتف:' : 'Phone:'}</b> <span dir="ltr">{app.phone}</span></p>
                  <p><b>{isAr ? 'الصفة المطلوبة:' : 'Requested role:'}</b> {roleLabel(app.requestedRole, lang)}</p>
                  <p><b>{isAr ? 'التخصص:' : 'Specialization:'}</b> {app.specialization || '—'}</p>
                  <p><b>{isAr ? 'سنوات الخبرة:' : 'Experience:'}</b> {app.experienceYears ?? '—'}</p>
                  <p><b>{isAr ? 'الرقم الشخصي:' : 'National ID:'}</b> {app.nationalId ? ('***' + app.nationalId.slice(-4)) : '—'}</p>
                  <p className="sm:col-span-2"><b>{isAr ? 'الشهادات / التراخيص:' : 'Certificates / licenses:'}</b> {app.licenses.length ? app.licenses.join('، ') : '—'}</p>
                  <p className="sm:col-span-2"><b>{isAr ? 'ملاحظات المتقدم:' : 'Applicant notes:'}</b> {app.applicantNotes || '—'}</p>
                </div>
                {app.reviewNotes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><b>{isAr ? 'ملاحظة المراجعة:' : 'Review note:'}</b> {app.reviewNotes}</p>}
              </div>
              {app.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <button disabled={processingId === app.id} onClick={() => void handleApplicationApproval(app.id)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"><CheckCircle className="h-4 w-4" />{isAr ? 'قبول وتفعيل الحساب' : 'Approve & activate account'}</button>
                  <button disabled={!!processingId} onClick={() => { setReviewTarget({ id: app.id, action: 'needs_info' }); setReviewNotes(''); }} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">{isAr ? 'طلب تعديل' : 'Request changes'}</button>
                  <button disabled={!!processingId} onClick={() => { setReviewTarget({ id: app.id, action: 'rejected' }); setReviewNotes(''); }} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{isAr ? 'رفض' : 'Reject'}</button>
                </div>
              )}
            </div>
            {reviewTarget?.id === app.id && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <label className="mb-1 block text-xs font-bold text-slate-500">{reviewTarget.action === 'needs_info' ? (isAr ? 'ما المطلوب تعديله؟' : 'What needs to change?') : (isAr ? 'سبب الرفض / ملاحظة' : 'Rejection reason / note')}</label>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <div className="mt-2 flex gap-2 justify-end">
                  <button onClick={() => { setReviewTarget(null); setReviewNotes(''); }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button disabled={processingId === app.id} onClick={() => void handleApplicationReview()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isAr ? 'تأكيد' : 'Confirm'}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-500">{t.pending}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{pendingStaff.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-500">{t.active}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activeStaff.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-bold text-slate-500">{t.inactive}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{inactiveStaff.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchStaff}
            className="w-full bg-white dark:bg-slate-900 text-sm py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['pending', 'active', 'inactive', 'all'] as const).map((f) => {
            const labels = { pending: t.pending, active: t.active, inactive: t.inactive, all: t.all };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title={isAr ? 'لا توجد طلبات مطابقة' : 'No matching requests'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <div key={member.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  member.status === 'pending'
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                    : member.status === 'active'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-br from-slate-400 to-slate-500'
                }`}>
                  {member.status === 'pending' ? <UserPlus className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{member.name}</p>
                    {statusBadge(member.status)}
                    <Badge color="blue">{roleLabel(member.role, lang)}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {member.specialization || roleLabel(member.role, lang)}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span dir="ltr">{member.email}</span>
                    <span dir="ltr">{member.phone}</span>
                    <span>{member.joinedDate}</span>
                  </div>
                </div>
                {member.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setActionTarget({ id: member.id, action: 'approve' })}
                      disabled={processingId === member.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} {t.approve}
                    </button>
                    <button
                      onClick={() => setActionTarget({ id: member.id, action: 'reject' })}
                      disabled={processingId === member.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} {t.reject}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onConfirm={handleConfirm}
        title={actionTarget?.action === 'approve'
          ? (isAr ? 'قبول الطلب' : 'Approve Request')
          : (isAr ? 'رفض الطلب' : 'Reject Request')}
        message={actionTarget?.action === 'approve'
          ? (isAr ? 'هل تريد قبول هذا الطلب وتفعيل حساب المستخدم؟' : 'Approve this request and activate the user account?')
          : (isAr ? 'هل تريد رفض هذا الطلب وتعطيل الحساب؟' : 'Reject this request and deactivate the account?')}
        confirmLabel={actionTarget?.action === 'approve' ? t.approve : t.reject}
      />
    </div>
  );
}
