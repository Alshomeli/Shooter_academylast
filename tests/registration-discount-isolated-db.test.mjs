import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('approved registration discount persists to player and survives renewal changes',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon;create role authenticated;
   create table public.players(id text primary key);
   create table public.registration_children(id uuid primary key, approved_player_id text);
   create table public.registration_child_fees(child_id uuid primary key, monthly_amount numeric(9,3), updated_by uuid);
   create table public.player_recurring_fees(player_id text primary key references public.players(id),monthly_amount numeric(9,3),updated_by uuid,updated_at timestamptz);
   insert into public.players values('player-1');
   insert into public.registration_children values('11111111-1111-4111-8111-111111111111',null);
   insert into public.registration_child_fees values('11111111-1111-4111-8111-111111111111',19.500,'22222222-2222-4222-8222-222222222222');
  `);
  const sql=await readFile(new URL('../supabase/migrations/20261018038000_sync_approved_registration_prices.sql',import.meta.url),'utf8');
  await db.exec(sql);
  await db.exec("update public.registration_children set approved_player_id='player-1' where id='11111111-1111-4111-8111-111111111111'");
  let rows=(await db.query("select monthly_amount from public.player_recurring_fees where player_id='player-1'")).rows;
  assert.equal(Number(rows[0].monthly_amount),19.5);
  await db.exec("update public.registration_child_fees set monthly_amount=17.000 where child_id='11111111-1111-4111-8111-111111111111'");
  rows=(await db.query("select monthly_amount from public.player_recurring_fees where player_id='player-1'")).rows;
  assert.equal(Number(rows[0].monthly_amount),17);
  assert.equal(rows.length,1);
 } finally {await db.close();}
});
