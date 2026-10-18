import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrations=[
 ['20260915002827_lock_internal_trigger_functions.sql',1],
 ['20260922221605_player_evaluations_workflow.sql',2],
 ['20260922221708_harden_player_evaluation_rpc_invoker.sql',2],
 ['20260922223822_fix_player_evaluation_rpc_invoker_access.sql',4],
];
for(const [filename,closures] of migrations){
 test('legacy migration syntax guard: '+filename,async()=>{
  const sql=await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8');
  const opened=(sql.match(/(?:^|\n)(?:as |DO )\$\$(?:\n|$)/gi)||[]).length;
  const closed=(sql.match(/^\$\$;$/gm)||[]).length;
  assert.equal(opened,closures,'expected SQL dollar quote starts');
  assert.equal(closed,closures,'all dollar-quoted blocks must end with $$;');
  assert.doesNotMatch(sql,/^\$;{1,2}$/gm,'invalid dollar-quoted terminator');
  assert.doesNotMatch(sql,/^DO \$$/gm,'DO statement must use paired $$');
 });
}
