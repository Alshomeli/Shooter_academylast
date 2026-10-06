import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as nodeModule from 'node:module';
import { webcrypto } from 'node:crypto';
const reports = await readFile(new URL('../supabase/functions/telegram-reply/reports.ts',import.meta.url),'utf8');
const entry = await readFile(new URL('../supabase/functions/telegram-reply/index.ts',import.meta.url),'utf8');
const source = reports.replace(/^export /gm,'') + '\n' + entry.replace(/^import .*;\n/gm,'');
const js = nodeModule.stripTypeScriptTypes ? nodeModule.stripTypeScriptTypes(source) : (await import('typescript')).default.transpileModule(source,{compilerOptions:{target:99,module:0}}).outputText;
function runtime(){
 let handler;const calls=[];
 const env={TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_WEBHOOK_SECRET:'test-secret',TELEGRAM_MANAGER_CHAT_IDS:'42',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-key'};
 const fetch=async(url,options={})=>{
  calls.push({url:String(url),options});const u=new URL(String(url));
  if(u.host==='api.telegram.org')return Response.json({ok:true});
  const table=u.pathname.split('/').at(-1);
  const rows=table==='matches'?[{id:'m',opponent:'المحرق',match_date:'2026-09-30',result:'scheduled'}]:[];
  return Response.json(rows,{headers:{'content-range':`0-0/${rows.length}`}});
 };
 new Function('Deno','fetch','crypto',js)({env:{get:k=>env[k]},serve:fn=>{handler=fn;}},fetch,webcrypto);
 const request=(chat=42,secret='test-secret',type='private',text='تفاصيل اليوم')=>new Request('https://example.test/function',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({message:{chat:{id:chat,type},text}})});
 return {calls,request,run:req=>handler(req)};
}
test('wrong webhook secret cannot query records or send reports',async()=>{
 const r=runtime();assert.equal((await r.run(r.request(42,'wrong'))).status,401);assert.equal(r.calls.length,0);
});
test('an unapproved chat cannot read the database',async()=>{
 const r=runtime();await r.run(r.request(99));const dbReads=r.calls.filter(c=>c.url.includes('/rest/v1/') && (c.options.method||'GET')==='GET');assert.equal(dbReads.length,0);assert.ok(r.calls.some(c=>c.url.includes('api.telegram.org')));
});
test('groups cannot retrieve manager details',async()=>{
 const r=runtime();await r.run(r.request(42,'test-secret','group'));const writes=r.calls.filter(c=>c.url.includes('/rest/v1/') && ['PATCH','DELETE','PUT'].includes(c.options.method));assert.equal(writes.length,0);
});
test('authorized private report includes matches and uses read-only REST',async()=>{
 const r=runtime();assert.equal((await r.run(r.request())).status,200);
 const reads=r.calls.filter(c=>c.url.includes('/rest/v1/'));assert.ok(reads.some(c=>c.url.includes('/matches?')));assert.ok(reads.filter(c=>(c.options.method||'GET')==='GET').some(c=>c.url.includes('/matches?')));
 const output=r.calls.filter(c=>c.url.includes('sendMessage')).map(c=>JSON.parse(c.options.body).text).join('\n');assert.match(output,/المحرق/);
});
test('unsupported write requests do not read or mutate the database',async()=>{
 const r=runtime();await r.run(r.request(42,'test-secret','private','احذف المباراة اليوم'));const writes=r.calls.filter(c=>c.url.includes('/rest/v1/') && ['PATCH','DELETE','PUT'].includes(c.options.method));assert.equal(writes.length,0);
});
