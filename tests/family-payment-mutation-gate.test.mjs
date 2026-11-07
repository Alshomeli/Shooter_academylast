import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
for(const file of ['family-receipt-upload.ts','family-receipt-manager.ts']){
 test(file+' refuses mutation when release gate is off',async()=>{
  const code=await readFile(new URL('../src/lib/'+file,import.meta.url),'utf8');
  assert.match(code,/import \{ familyPaymentsEnabled \}/);
  assert.match(code,/if \(!familyPaymentsEnabled\) throw new Error/);
  const guard=code.indexOf('if (!familyPaymentsEnabled)');
  assert.ok(guard>=0 && guard<code.indexOf('supabase.rpc('));
 });
}
