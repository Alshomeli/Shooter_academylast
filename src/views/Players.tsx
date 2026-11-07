import { useState, useMemo, useEffect, useDeferredValue, type FormEvent } from 'react';
import {
  Users, Plus, Search, Phone, Mail, Edit2, Trash2, Eye,
  FileText, Star, TrendingUp,
} from 'lucide-react';
import { evaluationFrameworkScores } from '@/lib/evaluation-scores';
import type { Player, Parent, Team, Lang, Role, PlayerEvaluation } from '@/types';
import { Badge, Modal, ConfirmDialog, PageHeader, EmptyState, FormField, FormError, SaveButton, inputCls } from '@/components/ui';
import { tr, positionLabel } from '@/lib/i18n';
import { ContactLinks } from '@/components/ContactLinks';
import { DocumentUpload } from '@/components/DocumentUpload';
import { fetchAllPlayerFiles } from '@/lib/uploads';
import { validateRequired, validatePhone, validateEmail, validateNumber, validateJerseyUnique } from '@/lib/validation';

interface PlayersProps {
  players: Player[];
  parents: Parent[];
  teams: Team[];
  evaluations: PlayerEvaluation[];
  onPlayersChange: (p: Player[]) => void;
  activeRole: Role;
  lang: Lang;
}

const POSITIONS = ['حارس مرمى', 'مدافع', 'خط وسط', 'مهاجم'];
const BLOOD_TYPES = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-'];

const POSITION_COLORS: Record<string, 'red' | 'blue' | 'emerald' | 'amber'> = {
  'حارس مرمى': 'amber',
  'مدافع': 'blue',
  'خط وسط': 'emerald',
  'مهاجم': 'red',
};

export function Players({ players, parents, teams, evaluations, onPlayersChange, activeRole, lang }: PlayersProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [parentLinkFilter, setParentLinkFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [photosLoading, setPhotosLoading] = useState(true);

  const canEdit = activeRole === 'manager' || activeRole === 'receptionist';

  useEffect(() => {
    let cancelled = false;
    setPhotosLoading(true);
    (async () => {
      const files = await fetchAllPlayerFiles();
      if (cancelled) return;
      const photos: Record<string, string> = {};
      for (const f of files) {
        if (f.fileCategory === 'photo' && !photos[f.playerId]) {
          photos[f.playerId] = f.publicUrl;
        }
      }
      setPhotoMap(photos);
      setPhotosLoading(false);
    })();
    return () => { cancelled = true; };
  }, [players]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return players.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.parentName.toLowerCase().includes(q)) return false;
      if (teamFilter !== 'all' && p.teamId !== teamFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (parentLinkFilter === 'linked' && !p.parentId) return false;
      if (parentLinkFilter === 'unlinked' && p.parentId) return false;
      return true;
    });
  }, [players, deferredSearch, teamFilter, statusFilter, parentLinkFilter]);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || (isAr ? 'غير محدد' : 'Not specified');

  const handleSave = async (data: Omit<Player, 'id'>, id?: string) => {
    if (id) {
      await onPlayersChange(players.map((p) => (p.id === id ? { ...data, id } : p)));
    } else {
      await onPlayersChange([...players, { ...data, id: `player-${Date.now()}` }]);
    }
    setShowAdd(false);
    setEditPlayer(null);
  };

  const handleDelete = async () => {
    if (deleteId) await onPlayersChange(players.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  };

  return (
    <div className="space-y-5 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.players} subtitle={isAr ? `${players.length} لاعب مسجل في الأكاديمية` : `${players.length} players registered`}>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم اللاعب أو ولي الأمر...' : 'Search by player or parent name...'}
            className="w-full bg-white dark:bg-slate-900 text-sm py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
          <option value="all">{isAr ? 'كل الفرق' : 'All teams'}</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select>
        <select value={parentLinkFilter} onChange={(e) => setParentLinkFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
          <option value="all">{isAr ? 'كل روابط أولياء الأمور' : 'All parent links'}</option>
          <option value="linked">{isAr ? 'ولي أمر مرتبط' : 'Parent linked'}</option>
          <option value="unlinked">{isAr ? 'بدون ولي أمر مرتبط' : 'No linked parent'}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="active">{t.active}</option>
          <option value="inactive">{t.inactive}</option>
        </select>
      </div>

      {/* Players grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title={isAr ? 'لا يوجد لاعبون مطابقون' : 'No matching players'} subtitle={isAr ? 'جرّب تعديل الفلاتر أو أضف لاعباً جديداً' : 'Try adjusting filters or add a new player'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 pt-14 pb-4 px-4 shadow-sm hover:shadow-md transition-shadow group mt-7">
              {/* Player photo / jersey fallback — floats above the card top edge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-10">
                {photosLoading && !photoMap[p.id] ? (
                  <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse border-2 border-white dark:border-slate-900" />
                ) : photoMap[p.id] ? (
                  <img
                    src={photoMap[p.id]}
                    alt={p.name}
                    loading="lazy"
                    className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-900 shadow-lg shadow-emerald-900/20"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-emerald-600/30 border-2 border-white dark:border-slate-900">
                    #{p.jerseyNumber}
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate text-center">{p.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 text-center">{teamName(p.teamId)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Badge color={p.status === 'active' ? 'emerald' : 'slate'}>
                  {p.status === 'active' ? t.active : t.inactive}
                </Badge>
                <Badge color={p.parentId ? 'blue' : 'amber'}>
                  {p.parentId ? (isAr ? 'ولي أمر مرتبط' : 'Parent linked') : (isAr ? 'بدون ربط' : 'Unlinked')}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge color={POSITION_COLORS[p.position] || 'slate'}>{positionLabel(p.position, lang)}</Badge>
                <span className="text-[11px] text-slate-400 font-semibold">{p.birthDate}</span>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span dir="ltr">{p.parentPhone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span dir="ltr" className="truncate">{p.parentEmail}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <ContactLinks phone={p.parentPhone} email={p.parentEmail} small />
                <button onClick={() => setViewPlayer(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                  <Eye className="h-3.5 w-3.5" /> {isAr ? 'عرض' : 'View'}
                </button>
                {canEdit && (
                  <>
                    <button onClick={() => setEditPlayer(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer">
                      <Edit2 className="h-3.5 w-3.5" /> {t.edit}
                    </button>
                    {activeRole === 'manager' && <button onClick={() => setDeleteId(p.id)} className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {(showAdd || editPlayer) && (
        <PlayerForm
          player={editPlayer}
          parents={parents}
          teams={teams}
          players={players}
          activeRole={activeRole}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditPlayer(null); }}
          lang={lang}
        />
      )}

      {/* View modal */}
      {viewPlayer && (
        <Modal open onClose={() => setViewPlayer(null)} title={isAr ? 'ملف اللاعب' : 'Player Profile'} size="lg">
          <PlayerDetail player={viewPlayer} team={teams.find((t) => t.id === viewPlayer.teamId)} evaluations={evaluations ?? []} lang={lang} />
        </Modal>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.deletePlayer}
        message={t.deletePlayerConfirm}
        confirmLabel={t.delete}
      />
    </div>
  );
}

function PlayerForm({ player, parents, teams, players, activeRole, onSave, onClose, lang }: {
  player: Player | null;
  teams: Team[];
  players: Player[];
  parents: Parent[];
  activeRole: Role;
  onSave: (data: Omit<Player, 'id'>, id?: string) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const canEditSensitive = activeRole === 'manager' || !player;
  const [form, setForm] = useState({
    version: player?.version,
    privateFieldsLoaded: player?.privateFieldsLoaded,
    name: player?.name || '',
    birthDate: player?.birthDate || '',
    bloodType: player?.bloodType || BLOOD_TYPES[0],
    jerseyNumber: player?.jerseyNumber || 1,
    position: player?.position || POSITIONS[0],
    teamId: player ? player.teamId : teams[0]?.id || '',
    parentName: player?.parentName || '',
    parentPhone: player?.parentPhone || '',
    parentEmail: player?.parentEmail || '',
    parentId: player?.parentId || '',
    status: player?.status || 'active',
    notes: player?.notes || '',
    joinedDate: player?.joinedDate || new Date().toISOString().substring(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    const nameCheck = validateRequired(form.name, t.name);
    if (!nameCheck.valid) e2.name = nameCheck.message!;
    const teamCheck = validateRequired(form.teamId, t.team);
    if (!teamCheck.valid) e2.teamId = teamCheck.message!;
    const jerseyCheck = validateNumber(form.jerseyNumber, 1, 99, t.jerseyNumber);
    if (!jerseyCheck.valid) e2.jerseyNumber = jerseyCheck.message!;
    else {
      const uniqueCheck = validateJerseyUnique(form.jerseyNumber, players.filter(p => p.teamId === form.teamId), player?.id);
      if (!uniqueCheck.valid) e2.jerseyNumber = uniqueCheck.message!;
    }
    const phoneCheck = validatePhone(form.parentPhone);
    if (!phoneCheck.valid) e2.parentPhone = phoneCheck.message!;
    const emailCheck = validateEmail(form.parentEmail);
    if (!emailCheck.valid) e2.parentEmail = emailCheck.message!;

    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    await onSave(form, player?.id);

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={player ? t.editPlayerTitle : t.addPlayerTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {Object.keys(errors).length > 0 && (
          <FormError message={t.fixFields} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={isAr ? 'الاسم بالكامل' : 'Full name'} error={errors.name}>
            <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((p) => ({ ...p, name: '' })); }} className={`${inputCls} ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`} required />
          </FormField>
          <FormField label={t.birthDate}>
            <input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={inputCls} />
          </FormField>
          <FormField label={t.jerseyNumber} error={errors.jerseyNumber}>
            <input type="number" min={1} max={99} value={form.jerseyNumber} onChange={(e) => { setForm({ ...form, jerseyNumber: parseInt(e.target.value) || 1 }); setErrors((p) => ({ ...p, jerseyNumber: '' })); }} className={`${inputCls} ${errors.jerseyNumber ? 'border-red-400 ring-1 ring-red-400' : ''}`} />
          </FormField>
          <FormField label={t.position}>
            <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={inputCls}>
              {POSITIONS.map((p) => <option key={p} value={p}>{positionLabel(p, lang)}</option>)}
            </select>
          </FormField>
          <FormField label={isAr ? 'فئة الفريق' : 'Team'} error={errors.teamId}>
            <select value={form.teamId} onChange={(e) => { setForm({ ...form, teamId: e.target.value }); setErrors((p) => ({ ...p, teamId: '' })); }} className={`${inputCls} ${errors.teamId ? 'border-red-400 ring-1 ring-red-400' : ''}`} required disabled={!canEditSensitive}>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
            {!canEditSensitive && <p className="text-[10px] text-amber-500 mt-1">{isAr ? 'يُتاح تعديل الفريق للمدير فقط' : 'Team editing is restricted to managers'}</p>}
          </FormField>
          <FormField label={t.bloodType}>
            <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} className={inputCls}>
              {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </FormField>
          <FormField label={isAr ? 'ربط ولي الأمر' : 'Linked parent'}>
            <select className={inputCls} value={form.parentId} disabled={!canEditSensitive} onChange={e => {
              const selected = parents.find(p => p.id === e.target.value);
              setForm({ ...form, parentId: selected?.id || '', parentName: selected?.name || '', parentPhone: selected?.phone || '', parentEmail: selected?.email || '' });
            }}><option value="">{isAr ? 'اختر ولي الأمر' : 'Select parent'}</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </FormField>
          <FormField label={t.parentName}>
            <input disabled={!!form.parentId} value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className={inputCls} />
          </FormField>
          <FormField label={t.parentPhone} error={errors.parentPhone}>
            <input disabled={!!form.parentId} value={form.parentPhone} onChange={(e) => { setForm({ ...form, parentPhone: e.target.value }); setErrors((p) => ({ ...p, parentPhone: '' })); }} className={`${inputCls} ${errors.parentPhone ? 'border-red-400 ring-1 ring-red-400' : ''}`} dir="ltr" />
          </FormField>
          <FormField label={isAr ? 'بريد ولي الأمر' : 'Parent email'} error={errors.parentEmail}>
            <input type="email" value={form.parentEmail} onChange={(e) => { setForm({ ...form, parentEmail: e.target.value }); setErrors((p) => ({ ...p, parentEmail: '' })); }} className={`${inputCls} ${errors.parentEmail ? 'border-red-400 ring-1 ring-red-400' : ''}`} dir="ltr" disabled={!canEditSensitive || !!form.parentId} />
            {!canEditSensitive && <p className="text-[10px] text-amber-500 mt-1">{isAr ? 'يُتاح تعديل البريد للمدير فقط' : 'Email editing is restricted to managers'}</p>}
          </FormField>
          <FormField label={t.status}>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className={inputCls}>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
            </select>
          </FormField>
        </div>
        <FormField label={t.notes}>
          <textarea disabled={activeRole !== 'manager' || form.privateFieldsLoaded === false} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">{t.cancel}</button>
          <SaveButton loading={saving}>{t.save}</SaveButton>
        </div>
      </form>
    </Modal>
  );
}

function PlayerDetail({ player, team, evaluations, lang }: { player: Player; team?: Team; evaluations: PlayerEvaluation[]; lang: Lang }) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const playerEvals = useMemo(() => evaluations.filter(e => e.playerId === player.id && e.status === 'published').sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate)), [evaluations, player.id]);
  const progress = useMemo(() => {
    if (playerEvals.length < 2) return null;
    const latest = playerEvals[0];
    const first = playerEvals[playerEvals.length - 1];
    const delta = (current: number | null, baseline: number | null) =>
      current != null && baseline != null ? current - baseline : null;
    return {
      firstDate: first.evaluationDate,
      latestDate: latest.evaluationDate,
      overall: delta(latest.overallScore, first.overallScore),
      technical: delta(evaluationFrameworkScores(latest).technical, evaluationFrameworkScores(first).technical),
      tactical: delta(evaluationFrameworkScores(latest).tactical, evaluationFrameworkScores(first).tactical),
      physical: delta(evaluationFrameworkScores(latest).physical, evaluationFrameworkScores(first).physical),
      psychosocial: delta(evaluationFrameworkScores(latest).psychosocial, evaluationFrameworkScores(first).psychosocial),
    };
  }, [playerEvals]);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-2xl">
          #{player.jerseyNumber}
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{player.name}</h3>
          <p className="text-sm text-slate-400">{team?.name || (isAr ? 'غير محدد' : 'Not specified')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow label={t.position} value={positionLabel(player.position, lang)} />
        <InfoRow label={t.birthDate} value={player.birthDate} />
        <InfoRow label={t.bloodType} value={player.bloodType} />
        <InfoRow label={t.jerseyNumber} value={`#${player.jerseyNumber}`} />
        <InfoRow label={isAr ? 'ولي الأمر' : 'Parent'} value={player.parentName} />
        <InfoRow label={t.parentPhone} value={player.parentPhone} ltr />
        <InfoRow label={isAr ? 'بريد ولي الأمر' : 'Parent email'} value={player.parentEmail} ltr />
        <InfoRow label={isAr ? 'تاريخ الانضمام' : 'Joined date'} value={player.joinedDate} />
      </div>
      <ContactLinks phone={player.parentPhone} email={player.parentEmail} />
      {player.notes && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-300">
          <p className="text-xs font-bold text-slate-400 mb-1">{t.notes}</p>
          {player.notes}
        </div>
      )}

      {/* Documents & Photos section */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'مستندات اللاعب' : 'Player documents'}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <DocumentUpload playerId={player.id} category="photo" label={isAr ? 'صور اللاعب' : 'Player photos'} compact />
          </div>
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <DocumentUpload playerId={player.id} category="document" label={isAr ? 'مستندات PDF / PNG' : 'PDF / PNG documents'} />
          </div>
        </div>
      </div>

      {/* Progress summary */}
      {progress && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'ملخص تطور اللاعب' : 'Player progress summary'}</h4>
          </div>
          <div className="p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
              {progress.firstDate} → {progress.latestDate} · {playerEvals.length} {isAr ? 'تقييمات منشورة' : 'published reviews'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: isAr ? 'الإجمالي' : 'Overall', value: progress.overall },
                { label: isAr ? 'فني' : 'Technical', value: progress.technical },
                { label: isAr ? 'تكتيكي' : 'Tactical', value: progress.tactical },
                { label: isAr ? 'بدني' : 'Physical', value: progress.physical },
                { label: isAr ? 'نفسي واجتماعي' : 'Psychosocial', value: progress.psychosocial },
              ].map(item => (
                <div key={item.label} className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70">
                  <p className="text-[10px] font-bold text-slate-400">{item.label}</p>
                  <p className={`text-sm font-black ${item.value == null ? 'text-slate-400' : item.value > 0.05 ? 'text-emerald-600' : item.value < -0.05 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>
                    {item.value == null ? '—' : `${item.value > 0 ? '+' : ''}${item.value.toFixed(1)}`}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-slate-400">{isAr ? 'التغير مقارنة بأول تقييم منشور للاعب.' : 'Change compared with the player’s first published review.'}</p>
          </div>
        </div>
      )}

      {/* Evaluations section */}
      {playerEvals.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{t.playerEvaluations}</h4>
          </div>
          <div className="space-y-3">
            {playerEvals.slice(0, 5).map(ev => (
              <div key={ev.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500">{ev.evaluationDate} &middot; {ev.periodType === 'monthly' ? t.monthly : ev.periodType === 'quarterly' ? t.quarterly : t.customPeriod}</span>
                  {ev.overallScore != null && <span className="text-sm font-black text-emerald-600">{ev.overallScore.toFixed(1)}/5</span>}
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                  {[{l: isAr ? 'فني' : 'TEC', v: ev.technicalScore}, {l: isAr ? 'تكت' : 'TAC', v: ev.tacticalScore}, {l: isAr ? 'بدن' : 'PHY', v: ev.physicalScore}, {l: isAr ? 'ذهن' : 'MEN', v: ev.mentalScore}, {l: isAr ? 'انض' : 'DIS', v: ev.disciplineScore}].map(s => (
                    <div key={s.l}>
                      <div className={`mx-auto w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs ${
                        !s.v ? 'bg-slate-300' : s.v >= 4 ? 'bg-emerald-500' : s.v >= 3 ? 'bg-amber-500' : 'bg-red-500'
                      }`}>{s.v ?? '-'}</div>
                      <p className="mt-1 font-bold text-slate-400">{s.l}</p>
                    </div>
                  ))}
                </div>
                {ev.strengths && <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400"><strong>{t.strengths}:</strong> {ev.strengths}</p>}
                {ev.coachRecommendation && <p className="text-[11px] text-blue-600 dark:text-blue-400"><strong>{t.coachRecommendation}:</strong> {ev.coachRecommendation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <p className="text-[11px] font-bold text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200" dir={ltr ? 'ltr' : undefined}>{value}</p>
    </div>
  );
}
