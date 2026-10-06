// Fixed, read-only projections. Never send raw records or free-form notes to a model.
export type Row = Record<string, unknown>;
export type ReadRows = (table: string, params: Record<string, string>) => Promise<Row[]>;
export type Topic = 'overview' | 'matches' | 'trainings' | 'revenue' | 'expenses' | 'subscriptions' | 'unpaid_subscriptions' | 'expiring_subscriptions' | 'active_players' | 'teams' | 'coaches' | 'staff' | 'attendance' | 'registrations' | 'evaluations' | 'tournaments' | 'parents';
export type ReportRequest = { topics: Topic[]; start?: string; end?: string; page: number; name?: string };
const PAGE_SIZE = 15;
const TOPICS: Topic[] = ['overview','matches','trainings','revenue','expenses','subscriptions','unpaid_subscriptions','expiring_subscriptions','active_players','teams','coaches','staff','attendance','registrations','evaluations','tournaments','parents'];
export function clean(text: string): string {
  return text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/[ً-ٟ]/g,'').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\s+/g,' ').trim();
}
export function shift(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0,10);
}
function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
export function reportRequest(text: string, today: string, fallback?: {intent: string; period: string}): ReportRequest | null {
  const q = clean(text);
  // Questions are read-only; never pretend a requested administrative write happened.
  if (/(^|\s)(احذف|اضف|عدل|سجل|انشئ|الغ|اعتمد|انقل|delete|update|create)(\s|$)/.test(q)) return null;
  const topics: Topic[] = [];
  if (/مبار|مباري|matches|\/matches/.test(q)) topics.push('matches');
  if (/تدريب|تدريبات|تمرين|تمارين|trainings/.test(q)) topics.push('trainings');
  if (/تقييم|تقدم|تطور|evaluations/.test(q)) topics.push('evaluations');
  if (/حضور|غياب|غائب|حاضر|attendance/.test(q)) topics.push('attendance');
  if (/غير مدفوع|لم يدفع|ما دفع|متاخر/.test(q)) topics.push('unpaid_subscriptions');
  else if (/اشتراك/.test(q)) topics.push(/تنتهي|ينتهي|انتهاء|منته/.test(q) ? 'expiring_subscriptions' : 'subscriptions');
  if (!topics.includes('unpaid_subscriptions') && /دفعات|دفع اليوم|دفع امس|دفعوا|مدفوعات|ايراد|دخل|payments|revenue/.test(q)) topics.push('revenue');
  if (/مصروف|مصاريف|expenses/.test(q)) topics.push('expenses');
  if (/تسجيل|طلبات/.test(q)) topics.push('registrations');
  if (/بطول|tournaments/.test(q)) topics.push('tournaments');
  if (!topics.length) {
    if (/مدرب|coaches/.test(q)) topics.push('coaches');
    else if (/موظف|طاقم|staff/.test(q)) topics.push('staff');
    else if (/لاعب|players/.test(q)) topics.push('active_players');
    else if (/فريق|فرق|teams/.test(q)) topics.push('teams');
    else if (/اولياء|ولي امر|اهالي|parents/.test(q)) topics.push('parents');
  }
  if (/ملخص|summary|\/day|شنو صار|شو صار|وش صار|تفاصيل (?:اليوم|يوم|امس|غدا)/.test(q) || (!topics.length && /تفاصيل/.test(q))) topics.push('overview');
  if (!topics.length && fallback && TOPICS.includes(fallback.intent as Topic)) topics.push(fallback.intent as Topic);
  if (!topics.length) return null;
  const dates = q.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates.some(d=>!validDate(d)) || dates.length > 2) throw new Error('invalid_report_date');
  let start: string | undefined, end: string | undefined;
  const period = fallback?.period;
  if (dates.length) { start = dates[0]; end = dates[1] || start; }
  else if (/امس|البارح/.test(q) || period === 'yesterday') start = end = shift(today,-1);
  else if (/غدا|بكره|بكرة/.test(q)) start = end = shift(today,1);
  else if (/الشهر الماضي/.test(q) || period === 'last_month') { end=shift(today.slice(0,8)+'01',-1); start=end.slice(0,8)+'01'; }
  else if (/هذا الشهر|الشهر الحالي/.test(q) || period === 'this_month') { start=today.slice(0,8)+'01'; end=today; }
  else if (/هذا الاسبوع|الاسبوع الحالي/.test(q) || period === 'this_week') { start=shift(today,-new Date(`${today}T12:00:00Z`).getUTCDay()); end=shift(start,6); }
  else if (/الاسبوع القادم|7 ايام|سبعة ايام/.test(q) || period === 'next_7_days') {start=shift(today,1);end=shift(today,7);}
  else if (!/كل الفترات|كل التواريخ|كامل السجل/.test(q) && (q.includes('اليوم') || topics.some(t=>['overview','matches','trainings','revenue','expenses','attendance','registrations','evaluations'].includes(t)))) start=end=today;
  else if (topics.includes('expiring_subscriptions')) {start=today;end=shift(today,7);}
  if (start && end && start > end) throw new Error('invalid_report_date');
  const page = Number(q.match(/(?:صفحه|صفحة|page)\s*(\d+)/)?.[1] || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new Error('invalid_report_page');
  const name = text.match(/(?:اللاعب|الفريق)\s*[«"]([^»"]+)[»"]/)?.[1]?.trim();
  return { topics: [...new Set(topics)],start,end,page,name };
}
function show(value: unknown): string {return value === null || value === undefined || value === '' ? 'غير مسجل' : String(value).replace(/[\r\n]/g,' ').slice(0,160);}
function money(value: unknown): string {return Number.isFinite(Number(value)) ? Number(value).toFixed(3) + ' د.ب' : 'غير مسجل';}
const labels: Record<string,string> = {scheduled:'مجدولة',win:'فوز',loss:'خسارة',draw:'تعادل',paid:'مدفوع',unpaid:'غير مدفوع',expired:'منتهي',active:'نشط',inactive:'غير نشط',present:'حاضر',absent:'غائب',late:'متأخر',excused:'بعذر',pending:'بانتظار المراجعة',approved:'معتمد',rejected:'مرفوض',draft:'مسودة',published:'منشور',monthly:'شهري',quarterly:'ربع سنوي',yearly:'سنوي',cash:'نقدًا',bank_transfer:'تحويل بنكي',benefit:'بنفت'};
function label(value: unknown): string {return labels[String(value)] || show(value);}
export async function detailedReport(request: ReportRequest, read: ReadRows): Promise<string> {
  const {start,end,page,name} = request;
  const date = start ? (start === end ? start : `${start} إلى ${end}`) : 'كل الفترات';
  const range = (column: string, timestamp=false): Record<string,string> => start && end ? {
    [`${column}_gte`]:`gte.${start}${timestamp?'T00:00:00+03:00':''}`,
    [`${column}_${timestamp?'lt':'lte'}`]:`${timestamp?'lt':'lte'}.${timestamp?shift(end,1):end}${timestamp?'T00:00:00+03:00':''}`,
  } : {};
  // Lookup projections exclude IDs, contact details, salaries and private notes from output.
  const players = await read('players',{select:'id,name,team_id,status,position,jersey_number',order:'id',limit:'1001'});
  const teams = await read('teams',{select:'id,name,age_group,coach_id,training_days,training_time,pitch_number',order:'id',limit:'1001'});
  const player = (id: unknown) => players.find(p=>p.id===id);
  const team = (id: unknown) => teams.find(t=>t.id===id);
  const playerName = (id: unknown) => show(player(id)?.name);
  const teamName = (id: unknown) => show(team(id)?.name);
  const selectedPlayers = name ? players.filter(p=>clean(show(p.name))===clean(name)) : [];
  const selectedTeams = name ? teams.filter(t=>clean(show(t.name))===clean(name)) : [];
  if (name && !selectedPlayers.length && !selectedTeams.length) return `لم أجد لاعبًا أو فريقًا بالاسم «${show(name)}». استخدم الاسم المسجل كاملًا.`;
  const sections: string[] = [`تقرير الإدارة — ${date}${name ? ` — ${show(name)}` : ''}`];
  if(players.length>=1001 || teams.length>=1001) sections.push('تنبيه: دليل الأسماء كبير؛ بعض الأسماء قد تظهر كغير مسجلة.');
  const topics: Topic[] = request.topics.includes('overview') ? ['matches','trainings','revenue','expenses','attendance','registrations','expiring_subscriptions'] : request.topics;
  async function section(title: string,table: string,select: string,params: Record<string,string>,format: (r: Row)=>string) {
    try {
      const filters = {...params};
      if (name) {
        const playerTables=['transactions','subscriptions','attendance','player_evaluations','players'];
        const teamTables=['matches','trainings','teams'];
        if (playerTables.includes(table)) {
          const ids=selectedPlayers.length?selectedPlayers.map(p=>p.id):players.filter(p=>selectedTeams.some(t=>t.id===p.team_id)).map(p=>p.id);
          if(!ids.length){sections.push(`${title}: لا توجد سجلات للاسم المحدد.`);return;}
          filters[table==='players'?'id':'player_id']='in.('+ids.map(id=>`"${String(id).replace(/["\\]/g,'')}"`).join(',')+')';
        } else if (teamTables.includes(table)) {
          const ids=selectedTeams.length?selectedTeams.map(t=>t.id):selectedPlayers.map(p=>p.team_id).filter(Boolean);
          if(!ids.length){sections.push(`${title}: لا يوجد فريق مسجل لهذا اللاعب.`);return;}
          filters[table==='teams'?'id':'team_id']='in.('+ids.map(id=>`"${String(id).replace(/["\\]/g,'')}"`).join(',')+')';
        } else { sections.push(`${title}: تصفية هذا القسم بالاسم غير مدعومة؛ اسأل عنه دون اسم.`);return; }
      }
      const rows = await read(table,{select,...filters,limit:String(PAGE_SIZE+1),offset:String((page-1)*PAGE_SIZE)});
      const visible=rows.slice(0,PAGE_SIZE);
      const total=(rows as Row[] & {total?: number}).total;
      sections.push(`${title} — صفحة ${page}${total === undefined ? '' : ` — إجمالي السجلات: ${total}`}\n${visible.length?visible.map((r,i)=>`${(page-1)*PAGE_SIZE+i+1}. ${format(r)}`).join('\n'):'لا توجد سجلات ضمن النطاق المطلوب.'}${rows.length>PAGE_SIZE?`\nتوجد سجلات أخرى؛ أعد السؤال مع «صفحة ${page+1}».`:''}`);
      if (table==='transactions' && visible.length) sections.push(`مجموع العمليات المعروضة فقط: ${money(visible.reduce((sum,r)=>sum+Number(r.amount||0),0))}`);
    } catch {sections.push(`${title}: تعذر جلب هذا القسم الآن؛ لا يعني ذلك عدم وجود بيانات.`);}
  }
  for(const topic of topics) {
    if(topic==='matches') await section('المباريات','matches','id,team_id,opponent,match_date,location,result,academy_score,opponent_score',{...range('match_date'),order:'match_date,id'},r=>`${teamName(r.team_id)} ضد ${show(r.opponent)} | ${show(r.match_date)} | ${show(r.location)} | ${label(r.result)}${r.result!=='scheduled' && r.academy_score!=null && r.opponent_score!=null?` | النتيجة ${r.academy_score}–${r.opponent_score}`:''}`);
    else if(topic==='trainings') await section('التدريبات المسجلة','trainings','id,team_id,title,session_date,duration_minutes',{...range('session_date'),order:'session_date,id'},r=>`${show(r.title)} | ${teamName(r.team_id)} | ${show(r.session_date)} | ${show(r.duration_minutes)} دقيقة`);
    else if(topic==='revenue'||topic==='expenses') {
      let subscriptions: Row[]=[];
      try { subscriptions=await read('subscriptions',{select:'id,plan_type,start_date,end_date,payment_method',order:'id',limit:'1001'});
      if(subscriptions.length>=1001) sections.push('تفاصيل بعض الاشتراكات قد لا تظهر بسبب حجم السجل.');
      } catch {sections.push('تعذر تحميل تفاصيل الاشتراكات المرتبطة بالدفعات.');}
      await section(topic==='revenue'?'الدفعات والإيرادات':'المصروفات','transactions','id,type,category,amount,transaction_date,subscription_id,player_id',{...range('transaction_date'),type:`eq.${topic==='revenue'?'revenue':'expense'}`,order:'transaction_date,id'},r=>{
        const sub=subscriptions.find(s=>s.id===r.subscription_id);
        return `${money(r.amount)} | ${show(r.transaction_date)} | ${show(r.category)}\n   اللاعب: ${playerName(r.player_id)} | الفريق: ${teamName(player(r.player_id)?.team_id)}\n   مرجع العملية: ${show(r.id)}${sub?` | ${label(sub.plan_type)} | ${show(sub.start_date)} إلى ${show(sub.end_date)} | الدفع: ${label(sub.payment_method)}`:''}`;
      });
    } else if(['subscriptions','unpaid_subscriptions','expiring_subscriptions'].includes(topic)) {
      await section('الاشتراكات','subscriptions','id,player_id,plan_type,amount,start_date,end_date,status,payment_method',{...(topic==='unpaid_subscriptions'?{status:'eq.unpaid'}:{}),...range(topic==='subscriptions'?'start_date':'end_date'),order:'end_date,id'},r=>`${playerName(r.player_id)} | ${label(r.plan_type)} | ${money(r.amount)} | ${label(r.status)} | ${show(r.start_date)} إلى ${show(r.end_date)} | ${label(r.payment_method)}`);
    } else if(topic==='active_players') await section('اللاعبون','players','id,name,team_id,status,position,jersey_number',{order:'name,id'},r=>`${show(r.name)} | ${teamName(r.team_id)} | ${label(r.status)} | المركز: ${show(r.position)} | القميص: ${show(r.jersey_number)}`);
    else if(topic==='teams') await section('الفرق وجدولها الأسبوعي','teams','id,name,age_group,training_days,training_time,pitch_number',{order:'name,id'},r=>`${show(r.name)} | الفئة: ${show(r.age_group)} | الأيام: ${show(r.training_days)} | ${show(r.training_time)} | الملعب: ${show(r.pitch_number)}`);
    else if(topic==='staff'||topic==='coaches') await section('الطاقم','staff','id,name,role,status,specialization',{...(topic==='coaches'?{role:'eq.coach'}:{}),order:'name,id'},r=>`${show(r.name)} | ${show(r.role)} | ${label(r.status)} | ${show(r.specialization)}`);
    else if(topic==='attendance') await section('الحضور والغياب','attendance','id,player_id,session_date,session_type,status',{...range('session_date'),order:'session_date,id'},r=>`${playerName(r.player_id)} | ${show(r.session_date)} | ${show(r.session_type)} | ${label(r.status)}`);
    else if(topic==='registrations') await section('طلبات التسجيل','registration_applications','id,status,submitted_at,registration_type',{...range('submitted_at',true),order:'submitted_at,id'},r=>`${show(r.id)} | ${label(r.status)} | ${show(r.registration_type)} | ${show(r.submitted_at)}`);
    else if(topic==='evaluations') await section('تقييمات اللاعبين','player_evaluations','id,player_id,evaluation_date,status,overall_score,technical_score,tactical_score,physical_score,mental_score,discipline_score,reassessment_date',{...range('evaluation_date'),order:'evaluation_date,id'},r=>`${playerName(r.player_id)} | ${show(r.evaluation_date)} | ${label(r.status)}\n   الإجمالي: ${show(r.overall_score)} | فني: ${show(r.technical_score)} | تكتيكي: ${show(r.tactical_score)} | بدني: ${show(r.physical_score)} | ذهني: ${show(r.mental_score)} | انضباط: ${show(r.discipline_score)} | إعادة التقييم: ${show(r.reassessment_date)}`);
    else if(topic==='tournaments') await section('البطولات','tournaments','id,name,organizer,season,start_date,end_date,teams_count',{...(start&&end?{start_date:`lte.${end}`,end_date:`gte.${start}`} : {}),order:'start_date,id'},r=>`${show(r.name)} | ${show(r.organizer)} | الموسم: ${show(r.season)} | ${show(r.start_date)} إلى ${show(r.end_date)} | الفرق: ${show(r.teams_count)}`);
    else if(topic==='parents') sections.push('بيانات اتصال أولياء الأمور لا تُعرض عبر Telegram. يمكن مراجعتها في المنصة بحسب صلاحياتك.');
  }
  sections.push('المصدر: سجلات المنصة. الوقت غير المسجل والرصيد المتبقي غير المحسوب لا يتم تخمينهما. لتحديد اسم استخدم: اللاعب «الاسم الكامل» أو الفريق «الاسم».');
  return sections.join('\n\n');
}
export function splitMessages(text: string): string[] {
  const chunks: string[]=[]; let remaining=text;
  while(remaining.length>3900) {let at=remaining.lastIndexOf('\n',3900);if(at<1)at=3900;if(/[\uD800-\uDBFF]/.test(remaining[at-1]))at--;chunks.push(remaining.slice(0,at));remaining=remaining.slice(at).replace(/^\n/,'');}
  if(remaining)chunks.push(remaining);return chunks;
}
