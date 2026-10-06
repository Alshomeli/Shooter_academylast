import assert from 'node:assert/strict';
import test from 'node:test';
import { reportRequest, detailedReport, splitMessages } from '../supabase/functions/telegram-reply/reports.ts';
const today='2026-09-30';
const fixtures={players:[{id:'p1',name:'لاعب تجريبي',team_id:'t1'}],teams:[{id:'t1',name:'فريق تجريبي'}],matches:[{id:'m1',team_id:'t1',opponent:'المحرق',match_date:today,location:'ملعب محرق',result:'scheduled',academy_score:0,opponent_score:0}],transactions:[{id:'r1',player_id:'p1',subscription_id:'s1',amount:25,transaction_date:today,category:'اشتراك'}],subscriptions:[{id:'s1',plan_type:'monthly',start_date:today,end_date:'2026-10-30',payment_method:'cash'}]};
const reader=async(table)=>fixtures[table]||[];
test('daily details and summary include scheduled matches, training and payments',async()=>{
 for(const text of ['ملخص اليوم','تفاصيل اليوم','تفاصيل يوم 2026-09-30']){
  const report=await detailedReport(reportRequest(text,today),reader);
  assert.match(report,/المحرق/);assert.match(report,/ملعب محرق/);assert.match(report,/التدريبات/);assert.match(report,/25.000/);assert.match(report,/لاعب تجريبي/);assert.doesNotMatch(report,/النتيجة 0/);
 }
});
test('dates and topics respect priorities and requested date',()=>{
 assert.deepEqual(reportRequest('مباريات الفريق غدا',today).topics,['matches']);
 assert.equal(reportRequest('مباريات الفريق غدا',today).start,'2026-10-01');
 assert.deepEqual(reportRequest('تقييم اللاعب اليوم',today).topics,['evaluations']);
 assert.deepEqual(reportRequest('حضور اللاعبين امس',today).topics,['attendance']);
 assert.equal(reportRequest('من دفع اليوم؟',today).topics[0],'revenue');
 assert.equal(reportRequest('تفاصيل يوم ٢٠٢٦-٠٩-٣٠',today).start,today);
 assert.throws(()=>reportRequest('تفاصيل يوم 2026-02-30',today),/invalid_report_date/);
 assert.throws(()=>reportRequest('المباريات صفحة 0',today),/invalid_report_page/);
 assert.equal(reportRequest('احذف المباراة اليوم',today,{intent:'matches',period:'today'}),null);
});
test('joins payments to player, team and subscription without inventing balance or receipt',async()=>{
 const report=await detailedReport(reportRequest('تفاصيل دفعات اليوم',today),reader);
 for(const v of ['لاعب تجريبي','فريق تجريبي','شهري','نقدًا','مرجع العملية: r1','25.000']) assert.ok(report.includes(v),v);
 assert.doesNotMatch(report,/المتبقي: 0|رقم الإيصال/);
});
test('all queries use explicit approved columns and pagination',async()=>{
 const calls=[];
 await detailedReport(reportRequest('تفاصيل اليوم',today),async(table,params)=>{calls.push({table,params});return reader(table)});
 for(const {params} of calls){assert.ok(params.select);assert.doesNotMatch(params.select,/\*|national_id|phone|email|notes|blood_type|salary|description/);}
 const match=calls.find(c=>c.table==='matches');assert.equal(match.params.match_date_gte,'gte.2026-09-30');assert.equal(match.params.match_date_lte,'lte.2026-09-30');
 const reg=calls.find(c=>c.table==='registration_applications');assert.equal(reg.params.submitted_at_lt,'lt.2026-10-01T00:00:00+03:00');
});
test('pagination is explicit, bounded and not represented as a full financial total',async()=>{
 let params;
 const report=await detailedReport(reportRequest('دفعات اليوم صفحة 2',today),async(table,p)=>{if(table==='transactions'){params=p;return Array.from({length:16},(_,i)=>({...fixtures.transactions[0],id:String(i)}));}return reader(table)});
 assert.equal(params.offset,'15');assert.equal(params.limit,'16');assert.match(report,/صفحة 3/);assert.match(report,/المعروضة فقط/);assert.match(report,/375.000/);
});
test('a failed section is reported instead of claiming no records',async()=>{
 const report=await detailedReport(reportRequest('تفاصيل اليوم',today),async(table)=>{if(table==='matches')throw Error('offline');return reader(table)});
 assert.match(report,/المباريات: تعذر/);assert.match(report,/25.000/);
});
test('unknown and unsupported requests do not invent an answer',()=>{
 assert.equal(reportRequest('ما حالة الطقس؟',today),null);
 assert.equal(reportRequest('سؤال غير معروف',today,{intent:'arbitrary_table',period:'today'}),null);
});
test('named filtering never returns another player',async()=>{
 let filter;
 await detailedReport(reportRequest('دفعات اللاعب «لاعب تجريبي» اليوم',today),async(table,p)=>{if(table==='transactions')filter=p.player_id;return reader(table)});
 assert.equal(filter,'in.("p1")');
 assert.match(await detailedReport(reportRequest('دفعات اللاعب «غير موجود» اليوم',today),reader),/لم أجد/);
});
test('long reports split without loss or broken surrogate pairs',()=>{
 const text=('تفاصيل ⚽'.repeat(1500));const chunks=splitMessages(text);
 assert.equal(chunks.join(''),text);assert.ok(chunks.every(x=>x.length<=3900));
});
