import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isSafePublicResearchQuestion, extractGrounding } from '../supabase/functions/ai-management-assistant/research.ts';

test('public coaching prompts and age ranges are accepted',()=>{
  assert.equal(isSafePublicResearchQuestion('اقترح تدريب هجوم للاعبين مواليد 2014-2015 لمدة 60 دقيقة'),true);
  assert.equal(isSafePublicResearchQuestion('Create a technical attacking drill for ages 8 to 10'),true);
});
test('private contact details must not be sent to web research',()=>{
  assert.equal(isSafePublicResearchQuestion('Please plan training for user@example.com'),false);
  assert.equal(isSafePublicResearchQuestion('Call +973 3333 1234 for details of a player'),false);
  assert.equal(isSafePublicResearchQuestion('بيانات اللاعب ورقم شخصي 12345'),false);
  assert.equal(isSafePublicResearchQuestion('hi'),false);
});
test('web source extraction filters unsafe URLs, duplicates, and bounds output',()=>{
  const p={candidates:[{groundingMetadata:{
    groundingChunks:[
      {web:{uri:'https://www.thefa.com/coaching',title:'Coaching practice'}},
      {web:{uri:'https://www.thefa.com/coaching',title:'Duplicate'}},
      {web:{uri:'javascript:alert(1)',title:'Unsafe'}},
      {web:{uri:'https://www.fifa.com/technical',title:'Football education'}},
    ],
    webSearchQueries:['youth football training 2026'],
    searchEntryPoint:{renderedContent:'<div>Search suggestions</div>'}
  }}]};
  const r=extractGrounding(p);
  assert.deepEqual(r.sources.map(s=>s.title),['Coaching practice','Football education']);
  assert.deepEqual(r.searchQueries,['youth football training 2026']);
  assert.match(r.searchEntryPoint,/Search suggestions/);
});
test('server research must run after role checks and before any private snapshot reads',async()=>{
  const code=await readFile(new URL('../supabase/functions/ai-management-assistant/index.ts',import.meta.url),'utf8');
  const role=code.indexOf('if(!roles[persona].includes(m.role))');
  const research=code.indexOf('if(b.mode==="research")');
  const database=code.indexOf('const queryErrors:Record<string,string>');
  assert.ok(role>0 && research>role && database>research,'Research must be authorized but avoid internal data aggregation');
  assert.match(code,/researchTraining\(q,lang,gk,model\)/);
});
test('web research is opt-in except for suggested youth training plans',async()=>{
  const code=await readFile(new URL('../src/lib/ai-assistant.ts',import.meta.url),'utf8');
  assert.match(code,/shouldUseWebResearch/);
  assert.match(code,/RECORD_PATTERNS/);
  assert.match(code,/body: \{ persona, question, lang, mode \}/);
});
