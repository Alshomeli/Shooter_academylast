import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration = readFileSync(new URL('../supabase/migrations/' + readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(f=>f.endsWith('coach_specialties_and_parent_portal.sql')), import.meta.url),'utf8');
const fixture = readFileSync(new URL('./fixtures/coach-specialties-baseline.sql', import.meta.url),'utf8');
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function setup(matchAware = false) {
 const db=new PGlite(); await db.exec(fixture); if (matchAware) await db.exec(readFileSync(new URL('../supabase/migrations/20261011035703_attendance_match_identity_rpc.sql',import.meta.url),'utf8')); await db.exec(migration);
 await db.exec(`insert into staff(id,user_id,name,email,phone,role,status,coach_kind) values
 ('manager','${uid(1)}','Manager','manager@example.test','','manager','active','team'),
 ('coach1','${uid(2)}','Coach 1','coach1@example.test','','coach','active','team'),
 ('coach2','${uid(3)}','Coach 2','coach2@example.test','','coach','active','team'),
 ('assistant','${uid(4)}','Assistant','assistant@example.test','','coach','active','assistant'),
 ('keeper','${uid(5)}','GK coach','keeper@example.test','','coach','active','goalkeeper'),
 ('unassigned','${uid(6)}','Unassigned','unassigned@example.test','','coach','active','assistant'),
 ('gk-assistant','${uid(9)}','GK assistant','gka@example.test','','coach','active','assistant');
 update staff set supervising_coach_id='coach1' where id='assistant';
 update staff set supervising_coach_id='keeper' where id='gk-assistant';
 insert into teams(id,name,coach_id) values('t1','Team 1','coach1'),('t2','Team 2','coach2');
 update teams set goalkeeper_coach_id='keeper';
 insert into parents(id,user_id,name,status) values('parent1','${uid(7)}','Parent 1','active'),('parent2','${uid(8)}','Parent 2','active');
 insert into players(id,name,team_id,parent_id,position,status) values
 ('p1','P1','t1','parent1','مهاجم','active'),('gk1','GK1','t1','parent1','حارس مرمى','active'),
 ('p2','P2','t2','parent2','مدافع','active'),('gk2','GK2','t2','parent2','Goalkeeper','active');`);
 return db;
}
async function actor(db,n) {await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid(n)}',false); set role authenticated;`);}
async function visible(db) {return (await db.query('select id from players order by id')).rows.map(r=>r.id);}
test('assistant inherits exactly the linked active coach player scope, unlinked assistant denied',async()=>{
 const db=await setup(); try {
  await actor(db,4); assert.deepEqual(await visible(db),['gk1','p1']);
  await actor(db,6); assert.deepEqual(await visible(db),[]);
  await actor(db,1); await db.exec("update staff set supervising_coach_id='coach2' where id='assistant'");
  await actor(db,4); assert.deepEqual(await visible(db),['gk2','p2']);
  await db.exec('reset role');await db.exec("update staff set status='inactive' where id='coach2'");
  await actor(db,4);assert.deepEqual(await visible(db),[]);
 } finally {await db.close();}
});
test('goalkeeper coach and linked assistant see only goalkeepers across age teams; position updates route automatically',async()=>{
 const db=await setup(); try {
  for(const n of [5,9]) {await actor(db,n); assert.deepEqual(await visible(db),['gk1','gk2']);}
  await actor(db,1);await db.exec("update players set position='GK' where id='p1'");
  await actor(db,5);assert.deepEqual(await visible(db),['gk1','gk2','p1']);
  const teams=(await db.query('select id,team_id from players order by id')).rows;
  assert.equal(teams.find(p=>p.id==='p1').team_id,'t1');
  const scope=await db.query("select internal.is_coach_of_team('t1') as entire_team");assert.equal(scope.rows[0].entire_team,false);
  assert.equal((await db.query("select internal.has_role(array['manager','accountant']) as financial")).rows[0].financial,false);
 } finally{await db.close();}
});
test('only manager can link an assistant; self, assistant chain, and non-coach links rejected',async()=>{
 const db=await setup();try{
  await actor(db,4);assert.equal((await db.query("update staff set supervising_coach_id='coach2' where id='assistant' returning id")).rows.length,0);
  await actor(db,1);
  for(const id of ['assistant','unassigned','manager']) await assert.rejects(db.query("update staff set supervising_coach_id=$1 where id='assistant'",[id]));
  await db.exec("update staff set supervising_coach_id=null where id='assistant'");
  await actor(db,4);assert.deepEqual(await visible(db),[]);
 }finally{await db.close();}
});
test('parent uploads and reads own child documents after approval; other child and forged path denied',async()=>{
 const db=await setup();try{
  await actor(db,7);
  await db.exec("insert into storage.objects(bucket_id,name,owner_id) values('player-documents','p1/photo.jpg','"+uid(7)+"')");
  await db.exec("insert into player_documents(player_id,file_name,file_path,file_type,file_category,file_size) values('p1','photo.jpg','p1/photo.jpg','image/jpeg','photo',120)");
  assert.equal((await db.query('select * from player_documents')).rows.length,1);
  await assert.rejects(db.exec("insert into player_documents(player_id,file_name,file_path,file_type,file_category,file_size) values('p2','x.pdf','p2/x.pdf','application/pdf','document',120)"));
  await assert.rejects(db.exec("insert into player_documents(player_id,file_name,file_path,file_type,file_category,file_size) values('p1','x.pdf','p2/x.pdf','application/pdf','document',120)"));
  await assert.rejects(db.exec("insert into storage.objects(bucket_id,name,owner_id) values('player-documents','p2/x.pdf','"+uid(7)+"')"));
  await actor(db,8);assert.equal((await db.query('select * from player_documents')).rows.length,0);
  await actor(db,7);assert.equal((await db.query("delete from storage.objects where name='p1/photo.jpg' returning id")).rows.length,0);
 }finally{await db.close();}
});
test('new staff requests keep approval gate and map specialties into coach policy',async()=>{
 const db=await setup();try{
  await db.exec(`insert into auth.users(id,email) values('${uid(10)}','new@example.test')`);
  await actor(db,10);
  const created=await db.query("select (internal.create_or_update_staff_application('assistant_coach','New Assistant','123')).id as id");
  const id=created.rows[0].id;
  await db.exec('reset role');await db.query("update staff_applications set status='pending' where id=$1",[id]);
  await db.query("select internal.approve_staff_application_as_staff($1,'manager')",[id]);
  const row=(await db.query("select role,coach_kind,supervising_coach_id from staff where user_id=$1",[uid(10)])).rows[0];
  assert.deepEqual(row,{role:'coach',coach_kind:'assistant',supervising_coach_id:null});
  await actor(db,10);assert.deepEqual(await visible(db),[]);
 }finally{await db.close();}
});
test('attendance and evaluation RPCs enforce player scope for new coach specialties',async()=>{
 const db=await setup();try{
  await db.exec("create unique index attendance_unique_player_session on attendance(player_id,session_date,session_type,(coalesce(training_id,'')),(coalesce(match_id,'')))");
  await actor(db,5);
  await db.query("select internal.record_attendance_entry_impl('gk1','2026-10-11','training','present',null,null)");
  await assert.rejects(db.query("select internal.record_attendance_entry_impl('p1','2026-10-11','training','present',null,null)"));
  const args="'2026-10-11'::date,'monthly',4::smallint,4::smallint,4::smallint,4::smallint,4::smallint,'','','',''";
  const saved=await db.query("select internal.save_player_evaluation_impl(null,'gk1',"+args+") as id");
  await db.query('select internal.publish_player_evaluation_impl($1)',[saved.rows[0].id]);
  await assert.rejects(db.query("select internal.save_player_evaluation_impl(null,'p1',"+args+")"));
  await actor(db,4);await db.query("select internal.record_attendance_entry_impl('p1','2026-10-11','training','present',null,null)");
  await assert.rejects(db.query("select internal.record_attendance_entry_impl('p2','2026-10-11','training','present',null,null)"));
  assert.equal((await db.query("select has_function_privilege('anon','internal.is_coach_of_player(text)','execute') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','internal.coach_has_player(text,text)','execute') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('manager goalkeeper routing isolates multiple specialists and revokes previous access', async()=>{
 const db=await setup();try{
  await db.exec(`insert into staff(id,user_id,name,role,status,coach_kind) values('keeper2','${uid(11)}','Second GK coach','coach','active','goalkeeper');`);
  await actor(db,1);await db.exec("update teams set goalkeeper_coach_id='keeper2' where id='t2'");
  await actor(db,5);assert.deepEqual(await visible(db),['gk1']);
  await actor(db,9);assert.deepEqual(await visible(db),['gk1']);
  await actor(db,11);assert.deepEqual(await visible(db),['gk2']);
  assert.equal((await db.query("update teams set goalkeeper_coach_id='keeper2' where id='t1' returning id")).rows.length,0);
  await actor(db,1);await assert.rejects(db.exec("update teams set goalkeeper_coach_id='coach1' where id='t1'"));
  await db.exec("update teams set goalkeeper_coach_id=null where id='t1'");
  await actor(db,5);assert.deepEqual(await visible(db),[]);
 }finally{await db.close();}
});
test('scope migration preserves seven argument match attendance and its validation',async()=>{
 const db=await setup(true);try{
  await db.exec("insert into matches(id,team_id,match_date) values('m1','t1','2026-10-11')");
  await actor(db,5);
  await db.query("select public.record_attendance_entry('gk1','2026-10-11','match','present',null,null,'m1')");
  await assert.rejects(db.query("select public.record_attendance_entry('gk2','2026-10-11','match','present',null,null,'m1')"));
  await assert.rejects(db.query("select public.record_attendance_entry('p1','2026-10-11','match','present',null,null,'m1')"));
  assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal' and proname='record_attendance_entry_impl'")).rows[0].n,1);
 }finally{await db.close();}
});
