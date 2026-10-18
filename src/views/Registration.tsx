import { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, User, Users, Camera, FileCheck, CheckCircle2,
  ChevronLeft, ChevronRight, Plus, Trash2, Upload, Loader2,
  AlertCircle, FileText, Image as ImageIcon, Info,
} from 'lucide-react';
import type {
  Lang, RegistrationType, RegistrationChildInput,
  RegistrationParentInput, RegistrationApplication,
} from '@/types';
import { tr } from '@/lib/i18n';
import { Badge, ConfirmDialog } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import {
  createDraft, updateDraft, uploadRegistrationFile, registerDocument,
  submitApplication, fetchMyApplications, getSignedUrl, errorMessage,
  addRegistrationChild, deleteRegistrationChild, deleteRegistrationApplication,
} from '@/lib/registration';
import { completeRegistrationUpload, registrationFilePath, type PendingUpload } from '@/lib/registration-upload';
import { compressImage, formatBytes } from '@/lib/image-compress';

interface Props {
  lang: Lang;
  initial?: RegistrationApplication;
  onSaved?: () => Promise<void>;
  onExit?: () => void;
  onBusyChange?: (busy: boolean) => void;
}
type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_ICONS = [ClipboardList, User, Users, Camera, FileCheck, CheckCircle2];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DOC_TYPES = ['parent_cpr', 'player_cpr', 'passport', 'birth_certificate', 'medical_report', 'other'] as const;
const inputCls = 'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white';
const maskCpr = (v: string) => v.length > 4 ? '***' + v.slice(-4) : v;
const blankChild = () => ({ clientKey: crypto.randomUUID(), _key: crypto.randomUUID(), fullName: '', nationalId: '', birthDate: '', bloodType: '', notes: '' });

interface ChildPhoto {
  file?: File; preview: string; compressed?: Blob; originalSize: number;
  compressedSize?: number; reductionPercent?: number; compressing?: boolean;
  uploading: boolean; uploaded: boolean; storagePath?: string; error?: string;
}
interface ExtraDoc {
  id: string; childId: string; docType: string; file?: File; fileName: string;
  uploading: boolean; uploaded: boolean; error?: string;
}

export function Registration({ lang, initial, onSaved, onExit, onBusyChange }: Props) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [resumeApp, setResumeApp] = useState(initial);
  const [existingApp, setExistingApp] = useState<RegistrationApplication | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [regType, setRegType] = useState<RegistrationType | ''>('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [parent, setParent] = useState<RegistrationParentInput>({
    registrationType: 'new_application', fullName: '', nationalId: '', phone: '', email: '',
    whatsapp: '', nationality: '', occupation: '', workplace: '', address: '', notes: '',
  });
  const [children, setChildren] = useState<(RegistrationChildInput & { _key: string })[]>(() => [blankChild()]);
  const [childPhotos, setChildPhotos] = useState<Record<string, ChildPhoto>>({});
  const [extraDocs, setExtraDocs] = useState<ExtraDoc[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [childIdMap, setChildIdMap] = useState<Record<string, string>>({});
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [applicationRef, setApplicationRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const uploads = useRef(new Map<string, PendingUpload>());
  const uploadLocks = useRef(new Set<string>());
  const previews = useRef(new Set<string>());
  const displayLang = useRef(lang);
  displayLang.current = lang;

  useEffect(() => {
    const urls = previews.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError('');
    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user?.email) throw new Error('Sign in to continue registration.');
        if (cancelled) return;
        setUserEmail(user.email);
        if (resumeApp) {
          if (!['draft', 'needs_info'].includes(resumeApp.status)) {
            setExistingApp(resumeApp); return;
          }
          const photos: Record<string, ChildPhoto> = {};
          await Promise.all(resumeApp.documents.filter(d => d.fileCategory === 'photo' && d.childId).map(async d => {
            const preview = await getSignedUrl(d.storagePath).catch(() => '');
            photos[d.childId!] = { preview, originalSize: d.fileSize, uploaded: true, uploading: false, storagePath: d.storagePath };
          }));
          if (cancelled) return;
          setRegType(resumeApp.registrationType);
          setParent({ registrationType: resumeApp.registrationType, fullName: resumeApp.parentName, nationalId: resumeApp.parentNationalId || '',
            phone: resumeApp.parentPhone, email: user.email, whatsapp: resumeApp.parentWhatsapp || '', nationality: resumeApp.parentNationality || '',
            occupation: resumeApp.parentOccupation || '', workplace: resumeApp.parentWorkplace || '', address: resumeApp.parentAddress || '', notes: resumeApp.parentNotes || '' });
          setChildren(resumeApp.children.map(c => ({ _key: c.id, clientKey: c.clientKey || c.id, childId: c.id, fullName: c.fullName,
            nationalId: c.nationalId || '', birthDate: c.birthDate, bloodType: c.bloodType || '', notes: c.notes || '' })));
          setChildIdMap(Object.fromEntries(resumeApp.children.map(c => [c.id, c.id])));
          setChildPhotos(photos);
          setExtraDocs(resumeApp.documents.filter(d => d.fileCategory === 'document').map(d => ({ id: d.id, childId: d.childId || '', docType: d.documentType || 'other', fileName: d.fileName, uploading: false, uploaded: true })));
          setDraftId(resumeApp.id); setStep(1); setExistingApp(null);
        } else {
          const apps = await fetchMyApplications();
          if (cancelled) return;
          setExistingApp(apps.find(a => a.status !== 'rejected' && a.status !== 'approved') || null);
          setParent(p => ({ ...p, email: user.email! }));
        }
      } catch (e) { if (!cancelled) setLoadError(errorMessage(e, displayLang.current === 'ar')); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [resumeApp, reload]);

  const stepLabels = [t.regStepType, t.regStepParent, t.regStepChildren, t.regStepDocuments, t.regStepReview, t.regStepSuccess];
  const validateParent = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (parent.fullName.trim().length < 2) e.fullName = t.regFieldRequired;
    if (!parent.nationalId.trim()) e.nationalId = t.regFieldRequired;
    if (!parent.phone.trim()) e.phone = t.regFieldRequired;
    if (!parent.email.trim()) e.email = t.regFieldRequired;
    else if (parent.email.trim().toLowerCase() !== userEmail.toLowerCase()) e.email = t.regEmailMismatch;
    return e;
  };
  const validateChildren = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!children.length) e._children = t.regChildRequired;
    children.forEach((c, i) => {
      if (c.fullName.trim().length < 2) e[`child_${i}_name`] = t.regFieldRequired;
      if (!c.nationalId.trim()) e[`child_${i}_cpr`] = t.regFieldRequired;
      if (!c.birthDate || c.birthDate > new Date().toISOString().slice(0, 10)) e[`child_${i}_birth`] = t.regFieldRequired;
    });
    return e;
  };
  const photosReady = children.length > 0 && children.every(c => childPhotos[c._key]?.uploaded);
  const filesReady = photosReady && extraDocs.every(d => d.uploaded);
  const filesBusy = Object.values(childPhotos).some(p => p.compressing || p.uploading) || extraDocs.some(d => d.uploading);
  const operationInProgress = draftCreating || submitting || filesBusy;
  useEffect(() => {
    onBusyChange?.(operationInProgress);
    return () => { onBusyChange?.(false); };
  }, [onBusyChange, operationInProgress]);
  const canGoNext = () => {
    if (step === 0) return !!regType;
    if (step === 1) return Object.keys(validateParent()).length === 0;
    if (step === 2) return Object.keys(validateChildren()).length === 0;
    if (step === 3) return filesReady && !filesBusy;
    if (step === 4) return confirmed && filesReady && !submitting;
    return false;
  };
  const saveDraft = async () => {
    if (draftId) {
      // New rows added after the draft exists are inserted one by one,
      // because update_registration_draft requires every existing child to stay in the payload.
      const newRows = children.filter(c => !childIdMap[c._key]);
      const map = { ...childIdMap };
      for (const c of newRows) {
        const { _key, ...row } = c;
        const saved = await addRegistrationChild(draftId, row);
        map[_key] = saved.childId;
      }
      setChildIdMap(map);
      const payload = children.map(({ _key, ...c }) => ({ ...c, childId: map[_key] || c.childId }));
      const parentPayload = { ...parent, registrationType: regType as RegistrationType, requestId };
      await updateDraft(draftId, parentPayload, payload);
      return;
    }
    const payload = children.map(({ _key, ...c }) => ({ ...c, childId: childIdMap[_key] || c.childId }));
    const parentPayload = { ...parent, registrationType: regType as RegistrationType, requestId };
    const result = await createDraft(parentPayload, payload);
    const map: Record<string, string> = {};
    for (const c of children) {
      const saved = result.children.find(ch => ch.clientKey === c.clientKey);
      if (!saved) throw new Error('Could not match the saved children. Reopen registration to resume the draft.');
      map[c._key] = saved.childId;
    }
    setDraftId(result.applicationId); setChildIdMap(map);
    await updateDraft(result.applicationId, parentPayload, children.map(({ _key, ...c }) => ({ ...c, childId: map[_key] })));
  };
  const handleSubmit = async () => {
    if (!draftId || !filesReady || !confirmed) return;
    setSubmitting(true); setSubmitError('');
    try {
      await submitApplication(draftId);
      setApplicationRef(draftId.slice(0, 8).toUpperCase()); setStep(5);
      // A refresh failure must not turn a successful submission into another write.
      await onSaved?.().catch(e => setSubmitError(errorMessage(e, isAr)));
    } catch (e) { setSubmitError(errorMessage(e, isAr)); }
    finally { setSubmitting(false); }
  };
  const goNext = async () => {
    if (busy.current || !canGoNext()) return;
    busy.current = true; setDraftError('');
    try {
      if (step === 0 && regType) { setParent(p => ({ ...p, registrationType: regType, email: userEmail })); setStep(1); }
      else if (step === 1) { setErrors(validateParent()); setStep(2); }
      else if (step === 2) {
        setDraftCreating(true); setErrors(validateChildren()); await saveDraft(); setStep(3);
      } else if (step === 3) { setConfirmed(false); setStep(4); }
      else if (step === 4) await handleSubmit();
    } catch (e) { setDraftError(errorMessage(e, isAr)); }
    finally { busy.current = false; setDraftCreating(false); }
  };
  const goBack = () => {
    if (busy.current || filesBusy) return;
    if (step > 0 && step < 5) setStep(s => (s - 1) as Step);
    setConfirmed(false); setErrors({});
  };

  const uploadPhoto = async (key: string, supplied?: ChildPhoto) => {
    const photo = supplied || childPhotos[key];
    const childId = childIdMap[key];
    if (!photo?.compressed || photo.uploaded || !draftId || !childId || uploadLocks.current.has(key)) return;
    uploadLocks.current.add(key);
    setChildPhotos(prev => ({ ...prev, [key]: { ...photo, uploading: true, error: undefined } }));
    try {
      let job = uploads.current.get(key);
      if (!job) { job = { path: registrationFilePath(draftId, childId, photo.compressed.type), uploaded: false }; uploads.current.set(key, job); }
      const blob = photo.compressed;
      await completeRegistrationUpload(job, path => uploadRegistrationFile(path, blob), path => registerDocument(draftId, childId, path, path.split('/').pop()!, blob.type, blob.size, 'photo', 'profile_photo'));
      setChildPhotos(prev => ({ ...prev, [key]: { ...photo, uploading: false, uploaded: true, storagePath: job.path } }));
    } catch (e) { setChildPhotos(prev => ({ ...prev, [key]: { ...photo, uploading: false, error: errorMessage(e, isAr) } })); }
    finally { uploadLocks.current.delete(key); }
  };
  const handlePhotoSelect = async (key: string, file: File) => {
    if (uploadLocks.current.has(key)) return;
    uploadLocks.current.add(key);
    const old = childPhotos[key]?.preview;
    if (old?.startsWith('blob:')) { URL.revokeObjectURL(old); previews.current.delete(old); }
    const preview = URL.createObjectURL(file); previews.current.add(preview); uploads.current.delete(key);
    const photo: ChildPhoto = { file, preview, originalSize: file.size, uploaded: false, uploading: false, compressing: true };
    setChildPhotos(prev => ({ ...prev, [key]: photo }));
    try {
      const result = await compressImage(file);
      const compressed = { ...photo, compressed: result.blob, compressedSize: result.compressedSize, reductionPercent: result.reductionPercent, compressing: false };
      setChildPhotos(prev => ({ ...prev, [key]: compressed }));
      uploadLocks.current.delete(key);
      await uploadPhoto(key, compressed);
    } catch (e) { setChildPhotos(prev => ({ ...prev, [key]: { ...photo, compressing: false, error: errorMessage(e, isAr) } })); }
    finally { uploadLocks.current.delete(key); }
  };
  const uploadExtraDoc = async (id: string, supplied?: ExtraDoc) => {
    const doc = supplied || extraDocs.find(d => d.id === id);
    const childId = doc && childIdMap[doc.childId];
    if (!doc?.file || doc.uploaded || !draftId || !childId || uploadLocks.current.has(id)) return;
    uploadLocks.current.add(id);
    setExtraDocs(prev => prev.map(d => d.id === id ? { ...d, uploading: true, error: undefined } : d));
    try {
      if (!doc.file.size || doc.file.size > 5_000_000) throw new Error(isAr ? 'يجب أن يكون المستند أقل من 5 ميجابايت.' : 'The document must be smaller than 5 MB.');
      let job = uploads.current.get(id);
      if (!job) { job = { path: registrationFilePath(draftId, childId, doc.file.type), uploaded: false }; uploads.current.set(id, job); }
      const file = doc.file;
      await completeRegistrationUpload(job, path => uploadRegistrationFile(path, file), path => registerDocument(draftId, childId, path, path.split('/').pop()!, file.type, file.size, 'document', doc.docType));
      setExtraDocs(prev => prev.map(d => d.id === id ? { ...d, uploading: false, uploaded: true } : d));
    } catch (e) { setExtraDocs(prev => prev.map(d => d.id === id ? { ...d, uploading: false, error: errorMessage(e, isAr) } : d)); }
    finally { uploadLocks.current.delete(id); }
  };
  const handleDocSelect = (childKey: string, docType: string, file: File) => {
    const doc: ExtraDoc = { id: crypto.randomUUID(), childId: childKey, docType, file, fileName: file.name, uploading: false, uploaded: false };
    setExtraDocs(prev => [...prev, doc]); void uploadExtraDoc(doc.id, doc);
  };
  const addChild = () => {
    if (draftCreating || submitting || filesBusy) return;
    setChildren(prev => [...prev, blankChild()]);
  };
  const removeChild = async (key: string) => {
    if (children.length <= 1 || draftCreating || submitting || filesBusy) return;
    const serverId = childIdMap[key];
    if (!serverId) {
      setChildren(prev => prev.filter(c => c._key !== key));
      return;
    }
    if (!draftId) return;
    try {
      await deleteRegistrationChild(draftId, serverId);
      setChildIdMap(prev => { const next = { ...prev }; delete next[key]; return next; });
      setChildren(prev => prev.filter(c => c._key !== key));
      setChildPhotos(prev => { const next = { ...prev }; delete next[key]; return next; });
      setExtraDocs(prev => prev.filter(d => d.childId !== key));
    } catch (e) { setDraftError(errorMessage(e, isAr)); }
  };
  const updateChild = (key: string, field: string, value: string) => setChildren(prev => prev.map(c => c._key === key ? { ...c, [field]: value } : c));
  const docTypeLabel = (dt: string) => ({ parent_cpr: t.regDocParentCpr, player_cpr: t.regDocPlayerCpr, passport: t.regDocPassport,
    birth_certificate: t.regDocBirthCert, medical_report: t.regDocMedical, other: t.regDocOther } as Record<string, string>)[dt] || dt;

  /* ================================================================== */
  /*  Render                                                            */
  /* ================================================================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32" dir={isAr ? 'rtl' : 'ltr'}>
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (loadError) return <div role="alert" className="space-y-3 p-5 text-red-600"><p>{loadError}</p><button onClick={() => setReload(n => n + 1)}>{isAr ? 'إعادة المحاولة' : 'Retry'}</button></div>;

  /* ---- Existing application status ---- */
  if (existingApp) {
    return <ExistingAppStatus app={existingApp} lang={lang} onContinue={() => setResumeApp(existingApp)} onDelete={async () => {
      try {
        await deleteRegistrationApplication(existingApp.id);
        setExistingApp(null);
        await onSaved?.().catch(() => {});
      } catch (e) { setLoadError(errorMessage(e, isAr)); }
    }} />;
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t.registrationWizard}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isAr ? 'أكاديمية شوتر لكرة القدم' : 'Shooter Football Academy'}
        </p>
      </div>

      {resumeApp?.reviewNotes && <p className="p-3 rounded-lg bg-amber-50 text-amber-800">{resumeApp.reviewNotes}</p>}
      {draftError && <p role="alert" className="p-3 text-sm text-red-600">{draftError}</p>}
      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 px-2">
        {stepLabels.map((label, i) => {
          const Icon = STEP_ICONS[i];
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <div className={`w-4 sm:w-8 h-0.5 rounded ${done ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition ${
                active ? 'bg-brand-600 text-white shadow' :
                done ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' :
                'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card */}
      <fieldset disabled={draftCreating || submitting} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6 shadow-sm">

        {/* ======== STEP 0: Registration Type ======== */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regStepType}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TypeCard
                selected={regType === 'initial_onboarding'}
                onClick={() => setRegType('initial_onboarding')}
                title={t.regTypeOnboarding}
                description={t.regTypeOnboardingDesc}
                icon={<Users className="h-6 w-6" />}
                color="blue"
              />
              <TypeCard
                selected={regType === 'new_application'}
                onClick={() => setRegType('new_application')}
                title={t.regTypeNew}
                description={t.regTypeNewDesc}
                icon={<Plus className="h-6 w-6" />}
                color="emerald"
              />
            </div>
          </div>
        )}

        {/* ======== STEP 1: Parent Info ======== */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regStepParent}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.regFullName} required error={errors.fullName}>
                <input value={parent.fullName} onChange={(e) => setParent((p) => ({ ...p, fullName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label={t.regCpr} required error={errors.nationalId}>
                <input value={parent.nationalId} onChange={(e) => setParent((p) => ({ ...p, nationalId: e.target.value }))} className={inputCls} dir="ltr" />
              </Field>
              <Field label={t.regPhone} required error={errors.phone}>
                <input value={parent.phone} onChange={(e) => setParent((p) => ({ ...p, phone: e.target.value }))} className={inputCls} dir="ltr" type="tel" />
              </Field>
              <Field label={t.regEmail} required error={errors.email}>
                <input value={parent.email} readOnly className={inputCls} dir="ltr" type="email" />
              </Field>
              <Field label={t.regWhatsapp}>
                <input value={parent.whatsapp} onChange={(e) => setParent((p) => ({ ...p, whatsapp: e.target.value }))} className={inputCls} dir="ltr" type="tel" />
              </Field>
              <Field label={t.regNationality}>
                <input value={parent.nationality} onChange={(e) => setParent((p) => ({ ...p, nationality: e.target.value }))} className={inputCls} />
              </Field>
              <Field label={t.regOccupation}>
                <input value={parent.occupation} onChange={(e) => setParent((p) => ({ ...p, occupation: e.target.value }))} className={inputCls} />
              </Field>
              <Field label={t.regWorkplace}>
                <input value={parent.workplace} onChange={(e) => setParent((p) => ({ ...p, workplace: e.target.value }))} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t.regAddress}>
                  <input value={parent.address} onChange={(e) => setParent((p) => ({ ...p, address: e.target.value }))} className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t.regNotes}>
                  <textarea value={parent.notes} onChange={(e) => setParent((p) => ({ ...p, notes: e.target.value }))} className={`${inputCls} min-h-16`} rows={2} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ======== STEP 2: Children ======== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regStepChildren}</h2>
              <button onClick={addChild} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition cursor-pointer">
                  {t.regAddChild}
                </button>
            </div>
            {errors._children && <p className="text-xs text-red-500 font-bold">{errors._children}</p>}
            {children.map((child, idx) => (
              <div key={child._key} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {isAr ? `اللاعب ${idx + 1}` : `Player ${idx + 1}`}
                  </span>
                  {children.length > 1 && (
                    <button onClick={() => removeChild(child._key)} className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-400 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" /> {t.regRemoveChild}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t.regChildName} required error={errors[`child_${idx}_name`]}>
                    <input value={child.fullName} onChange={(e) => updateChild(child._key, 'fullName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label={t.regChildCpr} required error={errors[`child_${idx}_cpr`]}>
                    <input value={child.nationalId} onChange={(e) => updateChild(child._key, 'nationalId', e.target.value)} className={inputCls} dir="ltr" />
                  </Field>
                  <Field label={t.regChildBirthDate} required error={errors[`child_${idx}_birth`]}>
                    <input type="date" max={new Date().toISOString().slice(0, 10)} value={child.birthDate} onChange={(e) => updateChild(child._key, 'birthDate', e.target.value)} className={inputCls} dir="ltr" />
                  </Field>
                  <Field label={t.regChildBloodType}>
                    <select value={child.bloodType} onChange={(e) => updateChild(child._key, 'bloodType', e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label={t.regChildNotes}>
                      <textarea value={child.notes} onChange={(e) => updateChild(child._key, 'notes', e.target.value)} className={`${inputCls} min-h-12`} rows={1} />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ======== STEP 3: Photos & Documents ======== */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regStepDocuments}</h2>
            {draftCreating && (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t.regSubmitting}</div>
            )}
            {draftError && <p className="text-xs text-red-500 font-bold">{draftError}</p>}

            {children.map((child, idx) => {
              const photo = childPhotos[child._key];
              const childDocs = extraDocs.filter((d) => d.childId === child._key);
              return (
                <div key={child._key} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {child.fullName || (isAr ? `اللاعب ${idx + 1}` : `Player ${idx + 1}`)}
                  </span>

                  {/* Profile photo */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      <Camera className="h-3.5 w-3.5" /> {t.regChildPhoto} <span className="text-red-500">*</span>
                    </label>
                    {photo ? (
                      <div className="flex items-start gap-3">
                        {photo.preview && <img src={photo.preview} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />}
                        <div className="text-xs space-y-1">
                          <p className="text-slate-500">{t.regOriginalSize}: <span className="font-bold text-slate-700 dark:text-slate-300">{formatBytes(photo.originalSize)}</span></p>
                          {photo.compressedSize != null && (
                            <>
                              <p className="text-slate-500">{t.regCompressedSize}: <span className="font-bold text-brand-600">{formatBytes(photo.compressedSize)}</span></p>
                              <p className="text-brand-600 font-bold">{t.regSaving}: {photo.reductionPercent}%</p>
                            </>
                          )}
                          {photo.compressing && <p className="text-blue-500">{isAr ? 'جارٍ ضغط الصورة…' : 'Compressing photo…'}</p>}
                          {photo.uploading && <p className="text-blue-500 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {isAr ? 'جاري الرفع...' : 'Uploading...'}</p>}
                          {photo.uploaded && <p className="text-brand-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {isAr ? 'تم الرفع' : 'Uploaded'}</p>}
                          {photo.error && (
                            <div>
                              <p className="text-red-500">{photo.error}</p>
                              <button disabled={photo.compressing || photo.uploading} onClick={() => photo.compressed ? void uploadPhoto(child._key) : photo.file && void handlePhotoSelect(child._key, photo.file)} className="text-blue-500 hover:underline cursor-pointer">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-brand-400 transition cursor-pointer">
                        <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                        <span className="text-xs font-bold text-slate-500">{t.regUploadPhoto}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handlePhotoSelect(child._key, e.target.files[0]); }} />
                      </label>
                    )}
                    {photo && <label className="block text-xs font-bold text-brand-600 mt-2">{isAr ? 'تغيير الصورة' : 'Replace photo'}<input aria-label={t.regChildPhoto} type="file" accept="image/jpeg,image/png,image/webp" disabled={photo.compressing || photo.uploading} className="block w-full mt-1" onChange={e => { if (e.target.files?.[0]) void handlePhotoSelect(child._key, e.target.files[0]); e.target.value = ''; }} /></label>}
                  </div>

                  {/* Extra documents */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      <FileText className="h-3.5 w-3.5" /> {t.regUploadDocument}
                    </label>
                    {childDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 text-xs py-1">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">{docTypeLabel(doc.docType)}: {doc.fileName}</span>
                        {doc.uploading && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                        {doc.uploaded && <CheckCircle2 className="h-3 w-3 text-brand-500" />}
                        {doc.error && <><span className="text-red-500">{doc.error}</span><button onClick={() => void uploadExtraDoc(doc.id)}>{isAr ? 'إعادة المحاولة' : 'Retry'}</button><button onClick={() => setExtraDocs(prev => prev.filter(d => d.id !== doc.id))}>{isAr ? 'إزالة المرفق' : 'Remove attachment'}</button></>}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <select id={`doc-type-${child._key}`} className={`${inputCls} max-w-40 text-xs`} defaultValue="player_cpr">
                        {DOC_TYPES.map((dt) => <option key={dt} value={dt}>{docTypeLabel(dt)}</option>)}
                      </select>
                      <label className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 cursor-pointer">
                        <Upload className="h-3.5 w-3.5" /> {t.regUploadDocument}
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => {
                          const sel = document.getElementById(`doc-type-${child._key}`) as HTMLSelectElement;
                          if (e.target.files?.[0]) handleDocSelect(child._key, sel.value, e.target.files[0]);
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======== STEP 4: Review ======== */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regStepReview}</h2>

            {/* Reg type */}
            <ReviewSection title={t.regStepType}>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {regType === 'initial_onboarding' ? t.regTypeOnboardingShort : t.regTypeNewShort}
              </p>
            </ReviewSection>

            {/* Parent */}
            <ReviewSection title={t.regParentInfo}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Dt label={t.regFullName} value={parent.fullName} />
                <Dt label={t.regCpr} value={maskCpr(parent.nationalId)} />
                <Dt label={t.regPhone} value={parent.phone} />
                <Dt label={t.regEmail} value={parent.email} />
                {parent.whatsapp && <Dt label={t.regWhatsapp} value={parent.whatsapp} />}
                {parent.nationality && <Dt label={t.regNationality} value={parent.nationality} />}
                {parent.occupation && <Dt label={t.regOccupation} value={parent.occupation} />}
                {parent.workplace && <Dt label={t.regWorkplace} value={parent.workplace} />}
                {parent.address && <Dt label={t.regAddress} value={parent.address} />}
              </dl>
            </ReviewSection>

            {/* Children */}
            <ReviewSection title={t.regChildrenInfo}>
              {children.map((child) => {
                const photo = childPhotos[child._key];
                return (
                  <div key={child._key} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    {photo?.preview && <img src={photo.preview} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                    <div className="text-sm">
                      <p className="font-bold text-slate-800 dark:text-white">{child.fullName}</p>
                      <p className="text-xs text-slate-500">{t.regChildCpr}: {maskCpr(child.nationalId)} · {t.regChildBirthDate}: {child.birthDate}</p>
                      {child.bloodType && <p className="text-xs text-slate-400">{t.regChildBloodType}: {child.bloodType}</p>}
                    </div>
                  </div>
                );
              })}
            </ReviewSection>

            {/* Documents */}
            {extraDocs.length > 0 && (
              <ReviewSection title={t.regDocuments}>
                {extraDocs.filter((d) => d.uploaded).map((doc) => (
                  <p key={doc.id} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 py-0.5">
                    <FileText className="h-3 w-3" /> {docTypeLabel(doc.docType)} — {doc.fileName}
                  </p>
                ))}
              </ReviewSection>
            )}

            {/* Confirmation */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-900/30 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-brand-600" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.regConfirmCheckbox}</span>
            </label>

            {submitError && <p className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {submitError}</p>}
          </div>
        )}

        {/* ======== STEP 5: Success ======== */}
        {step === 5 && (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{t.regSuccessTitle}</h2>
            {onExit && <button onClick={onExit} className="block mx-auto px-4 py-2 rounded-lg bg-brand-600 text-white">{isAr ? 'العودة إلى بوابة ولي الأمر' : 'Back to parent portal'}</button>}
            {submitError && <p role="alert" className="text-red-600 text-sm">{submitError}</p>}
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{t.regSuccessMessage}</p>
            <div className="inline-block px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
              {t.regReference}: <span className="font-black text-brand-600">{applicationRef}</span>
            </div>
          </div>
        )}

        {/* ======== Navigation buttons ======== */}
        {step < 5 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            {step > 0 ? (
              <button disabled={filesBusy || draftCreating || submitting} onClick={goBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
                {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.regBack}
              </button>
            ) : <div />}
            <button
              onClick={goNext}
              disabled={!canGoNext() || draftCreating || submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(draftCreating || submitting) && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 4 ? t.regSubmit : t.regNext}
              {step < 4 && !isAr && <ChevronRight className="h-4 w-4" />}
              {step < 4 && isAr && <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TypeCard({ selected, onClick, title, description, icon, color }: {
  selected: boolean; onClick: () => void; title: string;
  description: string; icon: React.ReactNode; color: 'blue' | 'emerald';
}) {
  const colors = color === 'blue' ? {
    ring: 'border-blue-500 ring-blue-500/30 bg-blue-50 dark:bg-blue-900/10',
    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', text: 'text-blue-700 dark:text-blue-400',
  } : {
    ring: 'border-brand-500 ring-brand-500/30 bg-brand-50 dark:bg-brand-900/10',
    icon: 'bg-brand-100 dark:bg-brand-900/30 text-brand-600', text: 'text-brand-700 dark:text-brand-400',
  };
  return (
    <button onClick={onClick} aria-pressed={selected} className={`p-5 rounded-xl border text-start transition cursor-pointer ${selected ? `ring-2 ${colors.ring}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${selected ? colors.icon : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{icon}</div>
      <h3 className={`text-sm font-black mb-1 ${selected ? colors.text : 'text-slate-800 dark:text-white'}`}>{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </button>
  );
}

function Field({ label, required, error, children: ch }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {ch}
      {error && <p className="text-[11px] text-red-500 font-bold mt-1">{error}</p>}
    </div>
  );
}

function ReviewSection({ title, children: ch }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
      {ch}
    </div>
  );
}

function Dt({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-sm font-bold text-slate-800 dark:text-white">{value}</dd>
    </div>
  );
}

function ExistingAppStatus({ app, lang, onContinue, onDelete }: { app: RegistrationApplication; lang: Lang; onContinue: () => void; onDelete: () => Promise<void> }) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDelete = ['draft', 'needs_info', 'rejected'].includes(app.status);
  const statusMap: Record<string, { label: string; color: 'slate' | 'amber' | 'blue' | 'emerald' | 'red' }> = {
    draft: { label: t.regStatusDraft, color: 'slate' },
    pending: { label: t.regStatusPending, color: 'amber' },
    under_review: { label: t.regStatusUnderReview, color: 'blue' },
    needs_info: { label: t.regStatusNeedsInfo, color: 'amber' },
    approved: { label: t.regStatusApproved, color: 'emerald' },
    rejected: { label: t.regStatusRejected, color: 'red' },
  };
  const s = statusMap[app.status] || statusMap.draft;

  return (
    <div className="max-w-lg mx-auto space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t.registrationWizard}</h1>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <Info className="h-7 w-7" />
        </div>
        <h2 className="text-base font-black text-slate-900 dark:text-white">{t.regExistingApp}</h2>
        {['draft', 'needs_info'].includes(app.status) && <button onClick={onContinue} className="block mx-auto px-4 py-2 bg-brand-600 text-white rounded-lg">{isAr ? 'استكمال الطلب' : 'Continue application'}</button>}
        <Badge color={s.color}>{s.label}</Badge>
        <p className="text-xs text-slate-500">{t.regReference}: <span className="font-black">{app.id.slice(0, 8).toUpperCase()}</span></p>
        {app.reviewNotes && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-400 text-right">
            <span className="font-bold">{t.regReviewNotes}:</span> {app.reviewNotes}
          </div>
        )}
        {canDelete && (
          <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> {t.regDeleteApp}
          </button>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t.regDeleteApp} message={t.regDeleteAppParentConfirm} confirmLabel={t.delete} cancelLabel={t.cancel} onConfirm={async () => { setDeleting(true); setConfirmDelete(false); await onDelete(); setDeleting(false); }} />
    </div>
  );
}
