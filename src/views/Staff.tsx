import { useState, useMemo, useDeferredValue, useEffect, type FormEvent } from 'react';
import {
  Dumbbell, Plus, Search, Edit2, Trash2, Eye, Mail, Phone, Award, Star,
  Briefcase, Calendar, FileUp, FileText, AlertTriangle,
} from 'lucide-react';
import type { Staff, Team, Player, Lang, Role, StaffDocument } from '@/types';
import { db } from '@/lib/store';
import { Badge, Modal, ConfirmDialog, PageHeader, EmptyState, SaveButton } from '@/components/ui';
import { tr, roleLabel } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { ContactLinks } from '@/components/ContactLinks';

interface StaffProps {
  staff: Staff[];
  teams: Team[];
  players: Player[];
  onStaffChange: (s: Staff[]) => void;
  onRefresh: () => Promise<void>;
  activeRole: Role;
  lang: Lang;
}

const ROLE_COLORS: Record<string, 'emerald' | 'blue' | 'amber' | 'slate'> = {
  manager: 'emerald',
  accountant: 'blue',
  coach: 'amber',
  receptionist: 'slate',
};

export function StaffView({ staff, teams, players, onStaffChange, onRefresh, activeRole, lang }: StaffProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const ROLE_FILTERS: Array<{ value: string; label: string }> = [
    { value: 'all', label: isAr ? 'كل الأدوار' : 'All roles' },
    { value: 'manager', label: t.manager },
    { value: 'accountant', label: t.accountant },
    { value: 'coach', label: t.coach },
    { value: 'receptionist', label: t.receptionist },
  ];
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Staff | null>(null);
  const [viewMember, setViewMember] = useState<Staff | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignCoachId, setReassignCoachId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [staffDocuments, setStaffDocuments] = useState<StaffDocument[]>([]);
  const [staffPhotoUrls, setStaffPhotoUrls] = useState<Record<string,string>>({});
  const [uploadMember, setUploadMember] = useState<Staff | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('certificate');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [documentError, setDocumentError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthUserId(user?.id ?? null)).catch(() => setAuthUserId(null));
  }, []);
  useEffect(() => {
    db.getStaffDocuments().then(async (docs) => {
      setStaffDocuments(docs);
      const photos = docs.filter(d => d.documentType === 'profile_photo');
      const pairs = await Promise.all(photos.map(async d => [d.staffId, await db.getStaffDocumentUrl(d.filePath)] as const));
      setStaffPhotoUrls(Object.fromEntries(pairs));
    }).catch(() => {});
  }, [staff.length]);

  const canManage = activeRole === 'manager';
  const canUploadFor = (member: Staff) => canManage || (!!authUserId && member.userId === authUserId);
  const canSeeSalary = activeRole === 'manager' || activeRole === 'accountant';

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (deferredSearch) {
        const q = deferredSearch.toLowerCase();
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.specialization.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      return true;
    });
  }, [staff, deferredSearch, roleFilter]);

  const coachTeams = (coachId: string) =>
    teams.filter((tm) => tm.coachId === coachId).map((tm) => tm.name);

  const coachPlayerCount = (coachId: string) => {
    const teamIds = teams.filter((tm) => tm.coachId === coachId).map((tm) => tm.id);
    return players.filter((p) => teamIds.includes(p.teamId)).length;
  };

  const handleSave = async (data: Omit<Staff, 'id'>, id?: string) => {
    if (id) {
      await onStaffChange(staff.map((s) => (s.id === id ? { ...data, id } : s)));
    } else {
      await onStaffChange([...staff, { ...data, id: `staff-${Date.now()}` }]);
    }
    setShowAdd(false);
    setEditMember(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteError('');
    try {
      await db.deleteStaff(deleteId, showReassign ? reassignCoachId : null);
      await onRefresh();
      setDeleteId(null);
      setShowReassign(false);
      setReassignCoachId(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshStaffDocuments = async () => {
    const docs = await db.getStaffDocuments(); setStaffDocuments(docs);
    const photos = docs.filter(d=>d.documentType==='profile_photo');
    const pairs = await Promise.all(photos.map(async d=>[d.staffId,await db.getStaffDocumentUrl(d.filePath)] as const));
    setStaffPhotoUrls(Object.fromEntries(pairs));
  };
  const handleDocumentUpload = async () => {
    if (!uploadMember || !uploadFile) return;
    try { setUploadBusy(true); setDocumentError(''); await db.uploadStaffDocument(uploadMember.id, uploadFile, uploadTitle || uploadFile.name, uploadType, uploadExpiry || undefined); await refreshStaffDocuments(); setUploadMember(null); setUploadFile(null); setUploadTitle(''); setUploadExpiry(''); setUploadType('certificate'); }
    catch(e){ setDocumentError(e instanceof Error?e.message:String(e)); }
    finally{ setUploadBusy(false); }
  };

  const initiateDelete = (id: string) => {
    const member = staff.find((s) => s.id === id);
    if (authUserId && member?.userId && member.userId === authUserId) {
      setDeleteError(isAr ? 'لا يمكن حذف حسابك الخاص أثناء استخدامك للنظام.' : 'You cannot delete your own account while signed in.');
      return;
    }
    const memberTeams = teams.filter((tm) => tm.coachId === id);
    setDeleteError('');
    setDeleteId(id);
    if (member?.role === 'coach' && memberTeams.length > 0) {
      setReassignCoachId(null);
      setShowReassign(true);
    } else {
      setShowReassign(false);
    }
  };

  return (
    <div className="space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.staff} subtitle={isAr ? `${staff.length} موظف ومدرب مسجل في الأكاديمية` : `${staff.length} staff & coaches registered`}>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        )}
      </PageHeader>

      {canManage && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4"><p className="text-xs text-slate-500">{isAr?'المدربون النشطون':'Active coaches'}</p><p className="text-2xl font-black mt-1">{staff.filter(s=>s.role==='coach'&&s.status==='active').length}</p></div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4"><p className="text-xs text-slate-500">{isAr?'بدون صورة شخصية':'Missing photo'}</p><p className="text-2xl font-black mt-1">{staff.filter(s=>s.role==='coach'&&!staffPhotoUrls[s.id]).length}</p></div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4"><p className="text-xs text-slate-500">{isAr?'بدون شهادة مرفوعة':'Missing certificate'}</p><p className="text-2xl font-black mt-1">{staff.filter(s=>s.role==='coach'&&!staffDocuments.some(d=>d.staffId===s.id&&d.documentType==='certificate')).length}</p></div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4"><p className="text-xs text-slate-500">{isAr?'إجمالي ملفات الطاقم':'Staff files'}</p><p className="text-2xl font-black mt-1">{staffDocuments.filter(d=>d.documentType!=='profile_photo').length}</p></div>
      </div>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث بالاسم أو البريد أو التخصص...' : 'Search by name, email or specialization...'}
            className="w-full bg-white dark:bg-slate-900 text-sm py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_FILTERS.map((rf) => (
            <button
              key={rf.value}
              onClick={() => setRoleFilter(rf.value)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                roleFilter === rf.value
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-8 w-8" />}
          title={isAr ? 'لا يوجد موظفون مطابقون' : 'No matching staff'}
          subtitle={isAr ? 'جرّب تعديل الفلاتر أو أضف موظفاً جديداً' : 'Try adjusting filters or add a new staff member'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((s) => {
            const isCoach = s.role === 'coach';
            const memberDocs = staffDocuments.filter(d=>d.staffId===s.id&&d.documentType!=='profile_photo');
            const today = new Date().toISOString().slice(0,10);
            const in30 = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
            const expiredDocs = memberDocs.filter(d=>d.expiryDate&&d.expiryDate<today).length;
            const expiringDocs = memberDocs.filter(d=>d.expiryDate&&d.expiryDate>=today&&d.expiryDate<=in30).length;
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                      {staffPhotoUrls[s.id] ? <img src={staffPhotoUrls[s.id]} alt="" className="w-full h-full object-cover"/> : (s.avatarUrl || '👤')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.specialization}</p>
                    </div>
                  </div>
                  <Badge color={s.status === 'active' ? 'emerald' : s.status === 'pending' ? 'amber' : 'slate'}>
                    {s.status === 'active' ? t.active : s.status === 'pending' ? t.pending : t.inactive}
                  </Badge>
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge color={ROLE_COLORS[s.role] || 'slate'}>{roleLabel(s.role, lang)}</Badge>
                  {canSeeSalary && (
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {s.salary.toLocaleString()} {t.currency}
                    </span>
                  )}
                </div>

                {isCoach && <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-center"><p className="text-sm font-black">{coachPlayerCount(s.id)}</p><p className="text-[9px] text-slate-400">{isAr?'لاعب':'Players'}</p></div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-center"><p className="text-sm font-black">{memberDocs.length}</p><p className="text-[9px] text-slate-400">{isAr?'مستند':'Docs'}</p></div>
                  <div className={`rounded-lg p-2 text-center ${expiredDocs>0?'bg-red-50 dark:bg-red-950/20':expiringDocs>0?'bg-amber-50 dark:bg-amber-950/20':'bg-slate-50 dark:bg-slate-800'}`}><p className={`text-sm font-black ${expiredDocs>0?'text-red-600':expiringDocs>0?'text-amber-600':''}`}>{expiredDocs||expiringDocs||0}</p><p className="text-[9px] text-slate-400">{expiredDocs>0?(isAr?'منتهي':'Expired'):expiringDocs>0?(isAr?'قريب':'Due soon'):(isAr?'تنبيه':'Alerts')}</p></div>
                </div>}

                {/* Coach-specific block */}
                {isCoach && (
                  <div className="mb-3 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 space-y-1.5">
                    {typeof s.rating === 'number' && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i <= Math.round(s.rating!)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                            }`}
                          />
                        ))}
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mr-1">
                          {s.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {s.tacticalStyle && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <Dumbbell className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{s.tacticalStyle}</span>
                      </div>
                    )}
                    {s.licenses && s.licenses.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{s.licenses.join('، ')}</span>
                      </div>
                    )}
                    {typeof s.experienceYears === 'number' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <Briefcase className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>{s.experienceYears} {isAr ? 'سنوات خبرة' : 'years exp'}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact */}
                <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span dir="ltr">{s.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span dir="ltr" className="truncate">{s.email}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <ContactLinks phone={s.phone} email={s.email} small />
                  {canUploadFor(s) && <button onClick={() => { setUploadMember(s); setUploadType('certificate'); }} className="flex items-center justify-center p-1.5 rounded-lg text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20" title={isAr?'إضافة صورة أو شهادة':'Add photo or document'}><FileUp className="h-3.5 w-3.5"/></button>}
                  <button
                    onClick={() => setViewMember(s)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> {isAr ? 'عرض' : 'View'}
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => setEditMember(s)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> {t.edit}
                      </button>
                      <button
                        onClick={() => initiateDelete(s.id)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {(showAdd || editMember) && (
        <StaffForm
          member={editMember}
          onSave={handleSave}
          onClose={() => {
            setShowAdd(false);
            setEditMember(null);
          }}
          lang={lang}
        />
      )}

      {/* View modal */}
      {viewMember && (
        <Modal open onClose={() => setViewMember(null)} title={isAr ? 'ملف الموظف' : 'Staff Profile'} size="lg">
          <StaffDetail
            member={viewMember}
            teams={coachTeams(viewMember.id)}
            playerCount={coachPlayerCount(viewMember.id)}
            canSeeSalary={canSeeSalary}
            lang={lang}
            documents={staffDocuments.filter(d=>d.staffId===viewMember.id)}
            photoUrl={staffPhotoUrls[viewMember.id]}
          />
        </Modal>
      )}

      <Modal open={!!uploadMember} onClose={()=>!uploadBusy&&setUploadMember(null)} title={isAr?'إضافة صورة أو مستند':'Add photo or document'}>
        <div className="space-y-4">
          {documentError&&<p role="alert" className="text-sm text-red-600">{documentError}</p>}
          <select value={uploadType} onChange={e=>setUploadType(e.target.value)} className={inputCls}><option value="certificate">{isAr?'شهادة / رخصة':'Certificate / license'}</option><option value="profile_photo">{isAr?'صورة شخصية':'Profile photo'}</option><option value="other">{isAr?'مستند آخر':'Other document'}</option></select>
          <input value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} className={inputCls} placeholder={isAr?'اسم المستند':'Document title'}/>
          <input type="file" accept={uploadType==='profile_photo'?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,application/pdf'} onChange={e=>setUploadFile(e.target.files?.[0]||null)} className="block w-full text-sm"/>
          {uploadType!=='profile_photo'&&<input type="date" value={uploadExpiry} onChange={e=>setUploadExpiry(e.target.value)} className={inputCls}/>}
          <button disabled={!uploadFile||uploadBusy} onClick={()=>void handleDocumentUpload()} className="w-full rounded-xl bg-emerald-600 text-white py-2.5 font-bold disabled:opacity-50">{uploadBusy?(isAr?'جارٍ الرفع...':'Uploading...'):(isAr?'رفع وحفظ':'Upload & save')}</button>
        </div>
      </Modal>

      {deleteError && <p role="alert" className="text-sm font-bold text-red-600">{deleteError}</p>}

      {/* Delete confirmation — coach reassignment or simple */}
      {deleteId && showReassign ? (
        <Modal open onClose={() => { setDeleteId(null); setShowReassign(false); }} title={t.reassignCoach} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.reassignCoachDesc}</p>
            {deleteError && <p role="alert" className="text-sm text-red-600">{deleteError}</p>}
            <select
              value={reassignCoachId ?? ''}
              onChange={(e) => setReassignCoachId(e.target.value || null)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
            >
              <option value="">{t.noReplacement}</option>
              {staff.filter((s) => s.role === 'coach' && s.status === 'active' && s.id !== deleteId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDeleteId(null); setShowReassign(false); }} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition cursor-pointer">
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={!reassignCoachId}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!deleteId && !showReassign}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title={t.deleteStaff}
          message={t.deleteStaffConfirm}
          confirmLabel={t.delete}
        />
      )}
    </div>
  );
}

/* ----------------------------- Form ----------------------------- */

function StaffForm({
  member,
  onSave,
  onClose,
  lang,
}: {
  member: Staff | null;
  onSave: (data: Omit<Staff, 'id'>, id?: string) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [form, setForm] = useState({
    version: member?.version,
    privateFieldsLoaded: member?.privateFieldsLoaded,
    userId: member?.userId,
    name: member?.name || '',
    email: member?.email || '',
    phone: member?.phone || '',
    role: member?.role || 'coach',
    salary: member?.salary ?? 0,
    specialization: member?.specialization || '',
    status: member?.status || 'active',
    joinedDate: member?.joinedDate || new Date().toISOString().substring(0, 10),
    avatarUrl: member?.avatarUrl || '👤',
    nationalId: member?.nationalId || '',
    experienceYears: member?.experienceYears ?? 0,
    rating: member?.rating ?? 0,
    tacticalStyle: member?.tacticalStyle || '',
    licenses: member?.licenses?.join('، ') || '',
    notes: member?.notes || '',
  });

  const isCoach = form.role === 'coach';

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    const licensesArray = form.licenses
      .split('،')
      .map((l) => l.trim())
      .filter(Boolean);
    await onSave(
      {
        version: member?.version, privateFieldsLoaded: member?.privateFieldsLoaded, userId: member?.userId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role as Role,
        salary: Number(form.salary) || 0,
        specialization: form.specialization,
        status: form.status as Staff['status'],
        joinedDate: form.joinedDate,
        avatarUrl: form.avatarUrl,
        nationalId: form.nationalId || undefined,
        experienceYears: isCoach ? Number(form.experienceYears) || 0 : undefined,
        rating: isCoach ? Number(form.rating) || 0 : undefined,
        tacticalStyle: isCoach ? form.tacticalStyle || undefined : undefined,
        licenses: isCoach ? licensesArray : undefined,
        notes: form.notes || undefined,
      },
      member?.id,
    );

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal open onClose={onClose} title={member ? t.editStaff : isAr ? 'إضافة موظف جديد' : 'Add New Staff'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isAr ? 'الاسم بالكامل' : 'Full name'}>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} required />
          </Field>
          <Field label={t.email}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} dir="ltr" required />
          </Field>
          <Field label={t.phone}>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={t.role}>
            <select value={form.role} onChange={(e) => set('role', e.target.value as Role)} className={inputCls}>
              <option value="manager">{t.manager}</option>
              <option value="accountant">{t.accountant}</option>
              <option value="coach">{t.coach}</option>
              <option value="receptionist">{t.receptionist}</option>
            </select>
          </Field>
          <Field label={isAr ? 'الراتب الشهري' : 'Monthly salary'}>
            <input
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => set('salary', Number(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>
          <Field label={t.specialization}>
            <input value={form.specialization} onChange={(e) => set('specialization', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.status}>
            <select value={form.status} onChange={(e) => set('status', e.target.value as Staff['status'])} className={inputCls}>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
              <option value="pending">{t.pending}</option>
            </select>
          </Field>
          <Field label={t.joinedDate}>
            <input type="date" value={form.joinedDate} onChange={(e) => set('joinedDate', e.target.value)} className={inputCls} />
          </Field>
          <Field label={isAr ? 'الرقم الوطني' : 'National ID'}>
            <input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>

        {/* Coach-specific fields */}
        {isCoach && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
            <Field label={isAr ? 'سنوات الخبرة' : 'Years of experience'}>
              <input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={(e) => set('experienceYears', Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <Field label={isAr ? 'التقييم (0 - 5)' : 'Rating (0 - 5)'}>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.rating}
                onChange={(e) => set('rating', Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <Field label={isAr ? 'الأسلوب التكتيكي' : 'Tactical style'}>
              <input value={form.tacticalStyle} onChange={(e) => set('tacticalStyle', e.target.value)} className={inputCls} />
            </Field>
            <Field label={isAr ? 'التراخيص والشهادات (افصل بفاصلة ،)' : 'Licenses & certificates (comma separated)'}>
              <input value={form.licenses} onChange={(e) => set('licenses', e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        <Field label={t.notes}>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} />
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {t.cancel}
          </button>
          <SaveButton loading={saving}>{t.save}</SaveButton>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------- Detail view --------------------------- */

function StaffDetail({
  member,
  teams,
  playerCount,
  canSeeSalary,
  lang,
  documents,
  photoUrl,
}: {
  member: Staff;
  teams: string[];
  playerCount: number;
  canSeeSalary: boolean;
  lang: Lang;
  documents: StaffDocument[];
  photoUrl?: string;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const isCoach = member.role === 'coach';

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-3xl overflow-hidden">
          {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover"/> : (member.avatarUrl || '👤')}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">{member.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge color={ROLE_COLORS[member.role] || 'slate'}>{roleLabel(member.role, lang)}</Badge>
            <Badge color={member.status === 'active' ? 'emerald' : member.status === 'pending' ? 'amber' : 'slate'}>
              {member.status === 'active' ? t.active : member.status === 'pending' ? t.pending : t.inactive}
            </Badge>
          </div>
          {member.specialization && (
            <p className="text-sm text-slate-400 mt-1">{member.specialization}</p>
          )}
        </div>
      </div>

      {/* Coach rating block */}
      {isCoach && typeof member.rating === 'number' && (
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1.5">{isAr ? 'التقييم العام' : 'Overall rating'}</p>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i <= Math.round(member.rating!)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                }`}
              />
            ))}
            <span className="text-sm font-black text-amber-600 dark:text-amber-400 mr-2">{member.rating.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* General info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow label={t.email} value={member.email} ltr />
        <InfoRow label={t.phone} value={member.phone} ltr />
        <InfoRow label={t.joinedDate} value={member.joinedDate} />
        {member.nationalId && <InfoRow label={isAr ? 'الرقم الوطني' : 'National ID'} value={member.nationalId} ltr />}
        {canSeeSalary && <InfoRow label={isAr ? 'الراتب الشهري' : 'Monthly salary'} value={`${member.salary.toLocaleString()} ${t.currency}`} />}
        <InfoRow label={t.specialization} value={member.specialization || '—'} />
      </div>

      <ContactLinks phone={member.phone} email={member.email} />

      {/* Coach specifics */}
      {isCoach && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {typeof member.experienceYears === 'number' && (
            <InfoRow label={isAr ? 'سنوات الخبرة' : 'Years of experience'} value={`${member.experienceYears} ${isAr ? 'سنة' : 'years'}`} />
          )}
          {member.tacticalStyle && <InfoRow label={isAr ? 'الأسلوب التكتيكي' : 'Tactical style'} value={member.tacticalStyle} />}
          {teams.length > 0 && <InfoRow label={isAr ? 'الفرق المُدرّبة' : 'Teams coached'} value={teams.join(isAr ? '، ' : ', ')} />}
          <InfoRow label={isAr ? 'عدد اللاعبين' : 'Player count'} value={`${playerCount} ${isAr ? 'لاعب' : 'players'}`} />
        </div>
      )}

      {/* Licenses */}
      {member.licenses && member.licenses.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" /> {isAr ? 'التراخيص والشهادات' : 'Licenses & certificates'}
          </p>
          <div className="flex flex-wrap gap-2">
            {member.licenses.map((lic, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30"
              >
                <Star className="h-3 w-3" /> {lic}
              </span>
            ))}
          </div>
        </div>
      )}

      {documents.filter(d=>d.documentType!=='profile_photo').length>0&&<div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2"><p className="text-xs font-black text-slate-500 flex items-center gap-1.5"><FileText className="h-4 w-4"/>{isAr?'المستندات والشهادات':'Documents & certificates'}</p>{documents.filter(d=>d.documentType!=='profile_photo').map(d=>{const today=new Date().toISOString().slice(0,10);const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);const expired=!!d.expiryDate&&d.expiryDate<today;const soon=!!d.expiryDate&&d.expiryDate>=today&&d.expiryDate<=in30;return <button key={d.id} onClick={async()=>window.open(await db.getStaffDocumentUrl(d.filePath),'_blank','noopener,noreferrer')} className="w-full flex items-center justify-between gap-3 border-t dark:border-slate-700 pt-3 text-sm"><span className="font-bold">{d.title}</span><span className={`flex items-center gap-1 text-xs font-bold ${expired?'text-red-600':soon?'text-amber-600':'text-emerald-600'}`}>{(expired||soon)&&<AlertTriangle className="h-3.5 w-3.5"/>}{expired?(isAr?'منتهية':'Expired'):soon?`${isAr?'تنتهي':'Expires'} ${d.expiryDate}`:d.expiryDate?`${isAr?'صالحة حتى':'Valid to'} ${d.expiryDate}`:(isAr?'عرض':'View')}</span></button>})}</div>}

      {/* Notes */}
      {member.notes && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-300">
          <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {t.notes}
          </p>
          {member.notes}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Helpers ----------------------------- */

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <p className="text-[11px] font-bold text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200" dir={ltr ? 'ltr' : undefined}>
        {value}
      </p>
    </div>
  );
}
