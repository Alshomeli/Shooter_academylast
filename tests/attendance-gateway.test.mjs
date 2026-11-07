import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../supabase/functions/ai-operations-gateway/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness() {
  let handler, action;
  const calls = [];
  const from = table => {
    let patch, inserting = false, fields;
    const chain = {
      select(value) { fields = value; return this; },
      eq() { return this; }, gte() { return this; }, lt() { return this; },
      update(value) { patch = value; return this; },
      insert(value) { patch = value; inserting = true; return this; },
      async result() {
        if (table === 'staff') return {data:{id:'manager',role:'manager',status:'active'}};
        if (table === 'players') return {data:{id:'p1',name:'Synthetic player',team_id:'t1',status:'active'}};
        if (inserting) {
          action = {...patch,id:'action-1',status:'pending',expires_at:new Date(Date.now()+60_000).toISOString()};
          return {data:action};
        }
        // Background expiry sweeps have no select; the selected claim/finalize writes do.
        if (patch && fields) { Object.assign(action,patch); return {data:{id:action.id}}; }
        if (patch) return {data:null};
        return fields === 'id' ? {count:0} : {data:action};
      },
      single() { return this.result(); }, maybeSingle() { return this.result(); },
      then(resolve,reject) { return this.result().then(resolve,reject); },
    };
    return chain;
  };
  const client = {
    auth:{getUser:async()=>({data:{user:{id:'user-1'}}})}, from,
    rpc:async(name,args)=>{ calls.push({name,args:JSON.parse(JSON.stringify(args))}); return {data:{id:'attendance-1'}}; },
  };
  vm.runInNewContext(code, {
    Request, Response, console,
    createClient:()=>client,
    Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',SUPABASE_ANON_KEY:'synthetic-anon'})[key]},serve:fn=>{handler=fn;}},
  });
  return {
    calls,
    request: body=>handler(new Request('https://example.invalid', {method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify(body)})),
  };
}

test('actual gateway handler preserves text matchId from prepare to confirmed RPC execution', async () => {
  const h = harness();
  const response = await h.request({mode:'prepare',operation:'record_attendance',params:{playerId:'p1',sessionDate:'2026-10-11',sessionType:'match',matchId:'match-non-uuid'}});
  assert.equal(response.status,200);
  const prepared = await response.json();
  assert.equal(prepared.preview.matchId,'match-non-uuid');
  assert.equal(h.calls.length,0);
  const executed = await h.request({mode:'execute',requestId:prepared.requestId,confirm:true});
  assert.equal(executed.status,200);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].name,'record_attendance_entry');
  assert.equal(h.calls[0].args.p_match_id,'match-non-uuid');
  assert.equal(h.calls[0].args.p_training_id,null);
});

test('gateway refuses mixed match/training links before invoking the business RPC', async () => {
  const h = harness();
  const response = await h.request({mode:'prepare',operation:'record_attendance',params:{playerId:'p1',sessionDate:'2026-10-11',sessionType:'training',matchId:'m1'}});
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'attendance_session_link_type_mismatch');
  assert.equal(h.calls.length,0);
});
