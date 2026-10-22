import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { GOALKEEPER_CRITERIA, OUTFIELD_CRITERIA, templateSummary, goalkeeperTotal } from '../src/lib/evaluation-template.ts';
const migration = await readFile(new URL('../supabase/migrations/20261022003259_goalkeeper_categories_and_pdf_evaluations.sql',import.meta.url),'utf8');
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup() {
 const db = new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create schema auth; create schema internal;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table staff(id text primary key,user_id uuid,role text,status text,coach_kind text,supervising_coach_id text);
 create table teams(id text primary key,name text,age_group text,coach_id text,goalkeeper_coach_id text,created_at timestamptz default now(),row_version bigint default 0);
 create table players(id text primary key,name text,team_id text references teams(id),position text,status text,archived_at timestamptz);
 create table trainings(id text primary key,team_id text references teams(id),session_date date);
 create table matches(id text primary key,team_id text references teams(id),match_date date);
 create table attendance(id text primary key,player_id text,training_id text,match_id text,session_date date,session_type text);
 create table player_evaluations(id uuid primary key default gen_random_uuid(),player_id text,team_id text references teams(id),coach_id text,evaluation_date date,period_type text,technical_score smallint,tactical_score smallint,physical_score smallint,mental_score smallint,discipline_score smallint,strengths text,development_areas text,coach_notes text,coach_recommendation text,overall_score numeric generated always as ((technical_score+tactical_score+physical_score+mental_score+discipline_score)::numeric/5) stored,status text default 'draft',published_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),row_version bigint default 0,detailed_scores jsonb default '{}',development_priorities text[],training_action text,reassessment_date date,final_recommendation text,
 constraint valid_reassessment check(reassessment_date is null or reassessment_date>=evaluation_date));
 create function internal.has_role(text[]) returns boolean language sql stable security definer as $$ select exists(select 1 from public.staff where user_id=auth.uid() and status='active' and role=any($1)) $$;
 create function internal.current_staff_id() returns text language sql stable security definer as $$ select id from public.staff where user_id=auth.uid() and status='active' limit 1 $$;
 insert into staff values('m','${uid(1)}','manager','active','team',null),('team-coach','${uid(2)}','coach','active','team',null),('keeper','${uid(3)}','coach','active','goalkeeper',null),('assistant','${uid(4)}','coach','active','assistant','keeper'),('pending','${uid(5)}','coach','inactive','goalkeeper',null);
 insert into teams(id,name,age_group,coach_id) values('t1','U12','U12','team-coach'),('t2','U14','U14',null);
 insert into players values('gk1','Keeper 1','t1','حارس مرمى','active',null),('gk2','Keeper 2','t2','GK','active',null),('p1','Forward','t1','مهاجم','active',null),('old','Archived','t1','goalkeeper','inactive',now());
 `);
 await db.exec(migration);
 await db.exec(`
 create trigger training_link before insert or update on attendance for each row execute function internal.validate_attendance_training_link();
 create trigger session_link before insert or update on attendance for each row execute function internal.validate_attendance_session_link();
 alter table players enable row level security;
 create policy player_scope on players for select to authenticated using (internal.has_role(array['manager']) or internal.coach_has_player(internal.current_staff_id(),id));
 grant usage on schema public,internal,auth to authenticated;
 grant select on all tables in schema public to authenticated;
 grant execute on function internal.coach_has_player(text,text),internal.coach_has_team(text,text),internal.delete_team_safely(text) to authenticated;
 `);
 return db;
}
async function actor(db,n) { await db.exec(`reset role; select set_config('test.user','${uid(n)}',false); set role authenticated;`); }
const keeperScores = () => Object.fromEntries(GOALKEEPER_CRITERIA.map((c,i)=>[c.key,(i%5)+1]));
const form = (playerId='gk1') => ({playerId,evaluationDate:'2026-10-22',periodType:'monthly',detailedScores:keeperScores(),heightCm:170.5,weightKg:65.2,nutritionPlan:'Balanced meals',evaluatorName:'Coach',generalRating:'good',evaluatorSignature:'Evaluator',coachSignature:'Coach',developmentPriorities:['Reflexes'],reassessmentDate:'2026-11-22'});
const save = async (db,payload) => (await db.query('select public.save_player_evaluation_v3($1::jsonb) id',[JSON.stringify(payload)])).rows[0].id;

test('PDF criterion counts, domain averages and goalkeeper total use criteria exactly once',()=>{
 assert.equal(OUTFIELD_CRITERIA.length,14); assert.equal(GOALKEEPER_CRITERIA.length,10);
 const scores=Object.fromEntries(GOALKEEPER_CRITERIA.map(c=>[c.key,5]));
 assert.equal(goalkeeperTotal(scores),50); assert.equal(goalkeeperTotal({...scores,gk_focus:null}),null);
 assert.deepEqual(templateSummary('goalkeeper',scores),{technical:5,tactical:5,physical:5,mental:5,discipline:5});
 assert.equal(templateSummary('outfield',{ball_control:1,passing:4}).technical,2.5);
});

test('goalkeeper coach and assistant see only nonarchived goalkeepers across normal age categories',async()=>{
 const db=await setup();try {
 for(const n of [3,4]) { await actor(db,n); assert.deepEqual((await db.query('select id from players order by id')).rows.map(r=>r.id),['gk1','gk2']); }
 await actor(db,5); assert.equal((await db.query('select id from players')).rows.length,0);
 await db.exec("reset role; update players set position='Goalkeeper' where id='p1'");
 await actor(db,3); assert.deepEqual((await db.query('select id from players order by id')).rows.map(r=>r.id),['gk1','gk2','p1']);
 assert.equal((await db.query("select team_id from players where id='gk1'")).rows[0].team_id,'t1');
 }finally{await db.close();}
});

test('goalkeeper category training permits only keepers without moving their registered category',async()=>{
 const db=await setup();try{
 await db.exec("insert into teams(id,name,category_kind,goalkeeper_coach_id) values('gk','Keepers','goalkeeper','keeper'); insert into trainings values('tr','gk','2026-10-22')");
 await actor(db,3);
 assert.equal((await db.query("select internal.coach_has_team('keeper','gk') allowed")).rows[0].allowed,true);
 assert.equal((await db.query("select internal.coach_has_team('keeper','t1') allowed")).rows[0].allowed,false);
 await db.exec("reset role; insert into attendance values('a','gk2','tr',null,'2026-10-22','training')");
 await assert.rejects(db.exec("insert into attendance values('bad','p1','tr',null,'2026-10-22','training')"),/eligible/);
 assert.equal((await db.query("select team_id from players where id='gk2'")).rows[0].team_id,'t2');
 }finally{await db.close();}
});

test('keeper PDF saves measurements, nutrition, signatures, automatic category and total out of fifty',async()=>{
 const db=await setup();try{
 await actor(db,3); const id=await save(db,{...form(),teamId:'t2',teamName:'Forged',evaluationType:'outfield'});
 const ev=(await db.query('select * from player_evaluations where id=$1',[id])).rows[0];
 assert.equal(ev.team_id,'t1');assert.equal(ev.team_name,'U12');assert.equal(ev.evaluation_type,'goalkeeper');assert.equal(ev.total_score,30);assert.equal(Number(ev.overall_score),3);
 assert.equal(Number(ev.height_cm),170.5);assert.equal(ev.nutrition_plan,'Balanced meals');assert.equal(ev.evaluator_signature,'Evaluator');
 await db.exec("reset role; update players set team_id='t2' where id='gk1'");await actor(db,3);
 await save(db,{...form(),id});assert.equal((await db.query('select team_name from player_evaluations where id=$1',[id])).rows[0].team_name,'U12');
 }finally{await db.close();}
});

test('backend blocks mixed templates, invalid scores, incomplete publication and unauthorized staff',async()=>{
 const db=await setup();try{
 await actor(db,3);
 await assert.rejects(save(db,{...form(),detailedScores:{...keeperScores(),shooting:5}}),/template/);
 await assert.rejects(save(db,{...form(),detailedScores:{...keeperScores(),gk_focus:5.5}}),/integer/);
 await assert.rejects(save(db,{...form(),heightCm:999}),/check constraint/);
 const incomplete=keeperScores();delete incomplete.gk_reflexes;
 const id=await save(db,{...form(),detailedScores:incomplete});
 await db.exec('reset role');await assert.rejects(db.query("update player_evaluations set status='published',published_at=now() where id=$1",[id]),/ten/);
 await actor(db,2);await assert.rejects(save(db,form('gk2')),/assigned/);
 await actor(db,5);await assert.rejects(save(db,form()),/authorized/);
 await actor(db,99);await assert.rejects(save(db,form()),/authorized/);
 }finally{await db.close();}
});

test('outfield PDF averages drive summary, and published evaluations stay immutable',async()=>{
 const db=await setup();try{
 await actor(db,2);const scores=Object.fromEntries(OUTFIELD_CRITERIA.map(c=>[c.key,4]));
 const id=await save(db,{...form('p1'),detailedScores:scores,generalRating:''});
 let ev=(await db.query('select * from player_evaluations where id=$1',[id])).rows[0];assert.equal(ev.evaluation_type,'outfield');assert.equal(ev.technical_score,4);assert.equal(ev.total_score,null);
 await db.exec('reset role');await db.query("update player_evaluations set status='published',published_at=now() where id=$1",[id]);
 await actor(db,2);await assert.rejects(save(db,{...form('p1'),id,detailedScores:scores}),/Published/);
 await db.exec('reset role');await assert.rejects(db.query("update player_evaluations set team_name='Changed' where id=$1",[id]),/Published/);
 }finally{await db.close();}
});

test('inactive categories delete only when empty; neither players nor historical records are detached',async()=>{
 const db=await setup();try{
 await db.exec("insert into teams(id,name) values('empty','Empty'); select set_config('test.user','"+uid(1)+"',false)");
 await assert.rejects(db.exec("select internal.delete_team_safely('empty')"),/Deactivate/);
 await db.exec("update teams set status='inactive' where id in ('empty','t1')");
 await assert.rejects(db.exec("select internal.delete_team_safely('t1')"),/linked/);
 assert.equal((await db.query("select team_id from players where id='gk1'")).rows[0].team_id,'t1');
 await db.exec("select internal.delete_team_safely('empty')");assert.equal((await db.query("select * from teams where id='empty'")).rows.length,0);
 for(const table of ['trainings','matches','player_evaluations']){
  const id='history-'+table;await db.query("insert into teams(id,name) values($1,'History')",[id]);
  if(table==='player_evaluations')await db.query('insert into player_evaluations(team_id) values($1)',[id]);
  else await db.query(`insert into ${table}(id,team_id) values($1,$1)`,[id]);
  await db.query("update teams set status='inactive' where id=$1",[id]);
  await assert.rejects(db.query('select internal.delete_team_safely($1)',[id]),/linked/);
 }
 }finally{await db.close();}
});

test('inactive and goalkeeper categories cannot replace a player age category',async()=>{
 const db=await setup();try{
 await db.exec("insert into teams(id,name,category_kind) values('gk','Keepers','goalkeeper'); update teams set status='inactive' where id='t2'");
 await assert.rejects(db.exec("update players set team_id='gk' where id='gk1'"),/registered age/);
 await assert.rejects(db.exec("update players set team_id='t2' where id='gk1'"),/inactive/);
 }finally{await db.close();}
});
