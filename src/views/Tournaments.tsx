import { useState, type FormEvent } from 'react';
import { Trophy, Plus, Edit2, Trash2, Calendar, Users, Building2, Medal } from 'lucide-react';
import type { Tournament, Lang, Role } from '@/types';
import { Badge, Modal, ConfirmDialog, PageHeader, EmptyState, SaveButton } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface TournamentsProps {
  tournaments: Tournament[];
  onTournamentsChange: (t: Tournament[]) => void;
  activeRole: Role;
  lang: Lang;
}

const EMOJI_OPTIONS = ['🏆', '🎖️', '🏅', '🥇', '🥈', '🥉', '⚽', '🔥'];

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white';

export function Tournaments({ tournaments, onTournamentsChange, activeRole, lang }: TournamentsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Tournament | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canEdit = activeRole === 'manager' || activeRole === 'coach';

  const handleSave = async (data: Omit<Tournament, 'id'>, id?: string) => {
    if (id) {
      await onTournamentsChange(tournaments.map((tn) => (tn.id === id ? { ...data, id } : tn)));
    } else {
      await onTournamentsChange([...tournaments, { ...data, id: `tour-${Date.now()}` }]);
    }
    setShowAdd(false);
    setEditItem(null);
  };

  const handleDelete = async () => {
    if (deleteId) await onTournamentsChange(tournaments.filter((tn) => tn.id !== deleteId));
    setDeleteId(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-5 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.tournaments} subtitle={`${tournaments.length} ${isAr ? 'بطولة مسجلة' : 'tournaments'}`}>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        )}
      </PageHeader>

      {tournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-8 w-8" />}
          title={isAr ? 'لا توجد بطولات مسجلة' : 'No tournaments registered'}
          subtitle={isAr ? 'ابدأ بإضافة بطولة جديدة لمتابعة المشاركات' : 'Add a new tournament to track participation'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((tn) => {
            const isActive = new Date(tn.startDate) <= new Date() && new Date(tn.endDate) >= new Date();
            const isUpcoming = new Date(tn.startDate) > new Date();
            return (
              <div
                key={tn.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shrink-0 shadow-lg">
                      {tn.logoEmoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{tn.name}</p>
                      <Badge color={isActive ? 'emerald' : isUpcoming ? 'blue' : 'gray'}>
                        {isActive
                          ? isAr ? t.ongoing : 'Active'
                          : isUpcoming
                            ? isAr ? t.upcoming : 'Upcoming'
                            : isAr ? t.completed : 'Finished'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-[12px] text-slate-500 dark:text-slate-400 flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="font-semibold">{tn.organizer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Medal className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="font-semibold">{isAr ? 'الموسم' : 'Season'}: {tn.season}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="font-semibold" dir="ltr">
                      {formatDate(tn.startDate)} — {formatDate(tn.endDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="font-semibold">
                      {tn.teamsCount} {isAr ? 'فريق مشارك' : 'teams'}
                    </span>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setEditItem(tn)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> {t.edit}
                    </button>
                    {activeRole === 'manager' && (
                    <button
                      onClick={() => setDeleteId(tn.id)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(showAdd || editItem) && (
        <TournamentForm
          tournament={editItem}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          lang={lang}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={isAr ? 'حذف البطولة' : 'Delete tournament'}
        message={isAr ? 'هل أنت متأكد من حذف هذه البطولة؟ لا يمكن التراجع.' : 'Are you sure? This cannot be undone.'}
        confirmLabel={t.delete}
      />
    </div>
  );
}

function TournamentForm({
  tournament,
  onSave,
  onClose,
  lang,
}: {
  tournament: Tournament | null;
  onSave: (data: Omit<Tournament, 'id'>, id?: string) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [form, setForm] = useState({
    version: tournament?.version,
    name: tournament?.name || '',
    organizer: tournament?.organizer || '',
    season: tournament?.season || String(new Date().getFullYear()),
    startDate: tournament?.startDate || '',
    endDate: tournament?.endDate || '',
    teamsCount: tournament?.teamsCount || 0,
    logoEmoji: tournament?.logoEmoji || '🏆',
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.organizer) return;
    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    await onSave(form, tournament?.id);

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={tournament ? t.editTournament : isAr ? 'إضافة بطولة جديدة' : 'Add New Tournament'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isAr ? 'اسم البطولة' : 'Tournament name'}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isAr ? 'مثال: كأس الرياض للبراعم' : 'e.g. Riyadh Youth Cup'} className={inputCls} required />
          </Field>
          <Field label={t.organizer}>
            <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} placeholder={isAr ? 'مثال: الاتحاد السعودي' : 'e.g. Saudi Federation'} className={inputCls} required />
          </Field>
          <Field label={t.season}>
            <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2026" className={inputCls} required />
          </Field>
          <Field label={t.teamsCount}>
            <input type="number" min={0} value={form.teamsCount} onChange={(e) => setForm({ ...form, teamsCount: parseInt(e.target.value) || 0 })} className={inputCls} />
          </Field>
          <Field label={t.startDate}>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} required dir="ltr" />
          </Field>
          <Field label={t.endDate}>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} required dir="ltr" />
          </Field>
        </div>

        <Field label={isAr ? 'شعار البطولة' : 'Tournament logo'}>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setForm({ ...form, logoEmoji: emoji })}
                className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border transition cursor-pointer ${
                  form.logoEmoji === emoji
                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
            {t.cancel}
          </button>
          <SaveButton loading={saving}>{t.save}</SaveButton>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
