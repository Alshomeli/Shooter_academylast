import { useState, type Dispatch, type SetStateAction } from 'react';
import { Save, Send, ChevronLeft } from 'lucide-react';
import type { Lang, Player, Team } from '@/types';
import { isGoalkeeper } from '@/lib/goalkeepers';
import { evaluationCriteria, SCORE_GROUPS, templateSummary, goalkeeperTotal, emptyEvaluation, type EvaluationDraft } from '@/lib/evaluation-template';
import { FormField, inputCls } from '@/components/ui';

interface Props {
  form: EvaluationDraft; setForm: Dispatch<SetStateAction<EvaluationDraft>>;
  players: Player[]; teams: Team[]; lang: Lang; saving: boolean; error: string;
  onSave: (publish: boolean) => Promise<void>; onClose: () => void;
}
export function PdfEvaluationForm({ form, setForm, players, teams, lang, saving, error, onSave, onClose }: Props) {
  const ar = lang === 'ar';
  const text = (a: string, e: string) => ar ? a : e;
  const [confirmPublish, setConfirmPublish] = useState(false);
  const player = players.find(p => p.id === form.playerId);
  const kind = form.id && form.evaluationType ? form.evaluationType : isGoalkeeper(player?.position || '') ? 'goalkeeper' : 'outfield';
  const keeper = kind === 'goalkeeper';
  const criteria = evaluationCriteria(kind);
  const detailGroups = keeper ? SCORE_GROUPS.map(g => ({ ...g, groups: [g.key] })) : [
    ...SCORE_GROUPS.slice(0,3).map(g => ({ ...g, groups: [g.key] })),
    { key: 'psychosocial', ar: 'نفسي واجتماعي', en: 'Psychosocial', groups: ['mental', 'discipline'] },
  ];
  const summary = templateSummary(kind, form.detailedScores);
  const total = goalkeeperTotal(form.detailedScores);
  const category = form.id && form.teamName ? form.teamName : teams.find(t => t.id === player?.teamId)?.name || '';
  const canPublish = !!form.playerId && !!category && Object.values(summary).every(v => v != null) && (!keeper || total != null);
  const patch = <K extends keyof EvaluationDraft>(key: K, value: EvaluationDraft[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const notes: { key: 'strengths' | 'developmentAreas' | 'coachNotes' | 'coachRecommendation' | 'trainingAction' | 'finalRecommendation' | 'nutritionPlan'; ar: string; en: string }[] = [
    { key: 'strengths', ar: 'نقاط القوة', en: 'Strengths' }, { key: 'developmentAreas', ar: 'مجالات التطوير', en: 'Development areas' },
    { key: 'coachNotes', ar: 'ملاحظات المدرب', en: 'Coach notes' }, { key: 'coachRecommendation', ar: 'توصية المدرب', en: 'Coach recommendation' },
    { key: 'trainingAction', ar: 'إجراء تدريبي مقترح', en: 'Suggested training action' },
    { key: 'finalRecommendation', ar: 'التوصية النهائية', en: 'Final recommendation' }, { key: 'nutritionPlan', ar: 'نظام التغذية', en: 'Nutrition plan' },
  ];
  return <section className="space-y-5 max-w-4xl mx-auto" dir={ar ? 'rtl' : 'ltr'}>
    <header className="flex items-center gap-3 border-b-4 border-brand-600 pb-4">
      <button type="button" disabled={saving} onClick={onClose} aria-label={text('رجوع', 'Back')} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className={ar ? 'rotate-180' : ''}/></button>
      <div><h2 className="text-xl font-black">{keeper ? text('تقييم حارس المرمى', 'Goalkeeper evaluation') : text('تقييم اللاعب', 'Player evaluation')}</h2><p className="text-xs text-slate-500 mt-1">{text('أكاديمية شوتر', 'Shooter Academy')}</p></div>
    </header>
    <form onSubmit={e => { e.preventDefault(); void onSave(false); }} className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-red-700 dark:text-red-300">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField label={keeper ? text('اسم الحارس *', 'Goalkeeper *') : text('اختر اللاعب *', 'Player *')}>
          <select required disabled={!!form.id || saving} value={form.playerId} onChange={e => setForm({ ...emptyEvaluation(form.evaluationDate), playerId: e.target.value, periodType: form.periodType })} className={inputCls}>
            <option value="">{text('اختر اللاعب', 'Select player')}</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}{isGoalkeeper(p.position) ? text(' — حارس مرمى', ' — Goalkeeper') : ''}</option>)}
            {form.id && !player && <option value={form.playerId}>{form.playerId}</option>}
          </select>
        </FormField>
        <FormField label={text('تاريخ التقييم *', 'Evaluation date *')}><input required type="date" value={form.evaluationDate} onChange={e => patch('evaluationDate', e.target.value)} className={inputCls}/></FormField>
        <FormField label={text('الفريق / الفئة العمرية', 'Team / age category')}><input readOnly aria-readonly="true" value={category} className={inputCls} placeholder={text('تحدد تلقائيًا عند اختيار اللاعب', 'Set automatically from the player')}/></FormField>
        <FormField label={text('فترة التقييم *', 'Evaluation period *')}><select value={form.periodType} onChange={e => patch('periodType', e.target.value)} className={inputCls}><option value="monthly">{text('شهري', 'Monthly')}</option><option value="quarterly">{text('ربع سنوي', 'Quarterly')}</option><option value="custom">{text('مخصص', 'Custom')}</option></select></FormField>
        <FormField label={text('وزن اللاعب (كجم)', 'Player weight (kg)')}><input type="number" min="1" max="300" step="0.1" value={form.weightKg ?? ''} onChange={e => patch('weightKg', e.target.value === '' ? null : Number(e.target.value))} className={inputCls}/></FormField>
        <FormField label={text('طول اللاعب (سم)', 'Player height (cm)')}><input type="number" min="30" max="250" step="0.1" value={form.heightCm ?? ''} onChange={e => patch('heightCm', e.target.value === '' ? null : Number(e.target.value))} className={inputCls}/></FormField>
      </div>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-black">{text('ملخص الدرجات', 'Score summary')}</h3><p className="text-xs text-slate-500">{text('متوسط درجات معايير كل مجال — يحسب تلقائيًا', 'Average criterion scores in each domain — calculated automatically')}</p>
        {SCORE_GROUPS.map(group => <div key={group.key} className="flex items-center gap-3"><span className="w-36 text-sm font-bold">{ar ? group.ar : group.en}</span><progress aria-label={ar ? group.ar : group.en} max={5} value={summary[group.key] ?? 0} className="flex-1 min-w-0 accent-brand-600"/><output className="text-sm font-black w-20" aria-live="polite">{summary[group.key] == null ? '—' : Number(summary[group.key]!.toFixed(2))}/5</output></div>)}
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h3 className="font-black">{text('التقييم التفصيلي', 'Detailed assessment')}</h3>
        <p className="text-xs text-slate-500">{keeper ? text('اختر درجة من 1 إلى 5 لكل معيار. تجمع درجات المعايير العشرة فقط لحساب المجموع النهائي.', 'Score each criterion from 1 to 5. Only the ten criterion scores count toward the final total.') : text('اختر 1–5، أو اترك المعيار غير مُقيّم.', 'Choose 1–5, or leave a criterion not rated.')}</p>
        {detailGroups.map(group => <fieldset key={group.key} className="border-t border-slate-200 dark:border-slate-700 pt-3"><legend className="px-2 text-sm font-black">{ar ? group.ar : group.en}</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{criteria.filter(c => group.groups.some(key => key === c.group)).map(c => <label key={c.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm"><span>{ar ? c.ar : c.en}</span><select aria-label={ar ? c.ar : c.en} value={form.detailedScores[c.key] ?? ''} onChange={e => patch('detailedScores', { ...form.detailedScores, [c.key]: e.target.value === '' ? null : Number(e.target.value) })} className={`${inputCls} !w-28 shrink-0`}><option value="">{text('غير مُقيّم', 'Not rated')}</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5</option>)}</select></label>)}</div></fieldset>)}
        {keeper && <p className="rounded-xl border border-brand-300 p-3 font-black text-brand-600 flex justify-between"><span>{text('المجموع النهائي', 'Final total')}</span><output aria-live="polite">{total ?? '—'}/50</output></p>}
        <p className="text-xs text-slate-500">{text('1 يحتاج إلى تطوير كبير • 2 ضعيف • 3 متوسط • 4 جيد • 5 ممتاز', '1 Major development needed • 2 Weak • 3 Average • 4 Good • 5 Excellent')}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4"><h3 className="font-black">{text('ملاحظات التقييم وخطة التطوير', 'Evaluation notes & development plan')}</h3>
        {keeper && <FormField label={text('اسم المقيّم', 'Evaluator name')}><input value={form.evaluatorName} maxLength={200} onChange={e => patch('evaluatorName', e.target.value)} className={inputCls}/></FormField>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {notes.map(note => <FormField key={note.key} label={ar ? note.ar : note.en}><textarea value={form[note.key]} maxLength={5000} rows={3} onChange={e => patch(note.key, e.target.value)} className={inputCls}/></FormField>)}
          {[0,1].map(i => <FormField key={i} label={i === 0 ? text('أولوية التطوير الأولى', 'Development priority 1') : text('أولوية التطوير الثانية', 'Development priority 2')}><input value={form.developmentPriorities[i] || ''} maxLength={500} onChange={e => { const priorities = [...form.developmentPriorities]; priorities[i] = e.target.value; patch('developmentPriorities', priorities); }} className={inputCls}/></FormField>)}
          <FormField label={text('موعد إعادة التقييم', 'Reassessment date')}><input type="date" min={form.evaluationDate} value={form.reassessmentDate || ''} onChange={e => patch('reassessmentDate', e.target.value || null)} className={inputCls}/></FormField>
        </div>
        {keeper && <><FormField label={text('التقدير العام', 'General rating')}><select value={form.generalRating} onChange={e => patch('generalRating', e.target.value)} className={inputCls}><option value="">{text('اختر التقدير', 'Select rating')}</option>{[['excellent','ممتاز','Excellent'],['very_good','جيد جدًا','Very good'],['good','جيد','Good'],['needs_development','يحتاج إلى تطوير','Needs development']].map(([v,a,en]) => <option key={v} value={v}>{text(a,en)}</option>)}</select></FormField><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormField label={text('توقيع المقيّم (الاسم)', 'Evaluator signature (name)')}><input value={form.evaluatorSignature} maxLength={200} onChange={e => patch('evaluatorSignature', e.target.value)} className={inputCls}/></FormField><FormField label={text('توقيع المدرب (الاسم)', 'Coach signature (name)')}><input value={form.coachSignature} maxLength={200} onChange={e => patch('coachSignature', e.target.value)} className={inputCls}/></FormField></div></>}
      </section>
      {!canPublish && form.playerId && <p className="text-sm text-amber-700 dark:text-amber-300">{keeper ? text('للنشر: يلزم ربط اللاعب بفئة وتعبئة المعايير العشرة.', 'To publish, the player needs a category and all ten criteria must be rated.') : text('للنشر: يلزم ربط اللاعب بفئة وتقييم معيار واحد على الأقل في كل مجال.', 'To publish, the player needs a category and at least one rated criterion in each domain.')}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving || !form.playerId} className="rounded-xl bg-slate-200 dark:bg-slate-700 px-4 py-3 font-bold flex gap-2 disabled:opacity-50"><Save size={18}/>{text('حفظ كمسودة', 'Save draft')}</button><button type="button" disabled={saving || !canPublish} onClick={() => setConfirmPublish(true)} className="rounded-xl bg-brand-600 text-white px-4 py-3 font-bold flex gap-2 disabled:opacity-50"><Send size={18}/>{text('نشر التقييم', 'Publish evaluation')}</button></div>
      {confirmPublish && <div role="alert" className="rounded-xl border border-amber-300 p-4 space-y-3"><p>{text('بعد النشر يظهر التقييم لولي الأمر ولا يمكن تعديله. هل تريد النشر؟', 'Publishing shares the review with the parent and prevents edits. Publish?')}</p><div className="flex gap-3"><button disabled={saving} type="button" onClick={() => void onSave(true)} className="rounded-lg bg-brand-600 text-white px-4 py-2">{text('تأكيد النشر', 'Confirm publish')}</button><button disabled={saving} type="button" onClick={() => setConfirmPublish(false)}>{text('رجوع', 'Back')}</button></div></div>}
    </form>
  </section>;
}
