import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/20261022125000_academy_parent_reviews.sql', import.meta.url),'utf8');

test('parent-review migration executes in fresh ephemeral PostgreSQL and creates guarded schema', async () => {
  const db = new PGlite();
  try {
    // This database exists only in memory. No remote connection or genuine user data.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as 'select null::uuid';
      create table public.parents (user_id uuid, status text);
      create table public.staff (user_id uuid, role text, status text);
    `);
    await db.exec(migration);
    const {rows:tables}=await db.query("select relrowsecurity from pg_class where oid='public.academy_parent_reviews'::regclass");
    assert.equal(tables[0].relrowsecurity,true,'RLS must be enabled');
    const {rows:policies}=await db.query("select policyname,cmd from pg_policies where schemaname='public' and tablename='academy_parent_reviews'");
    assert.ok(policies.some(x=>x.policyname==='Parents read only their reviews'&&x.cmd==='SELECT'));
    assert.ok(policies.some(x=>x.policyname==='Parents submit own pending reviews'&&x.cmd==='INSERT'));
    const {rows:fn}=await db.query("select proname,prosecdef from pg_proc where proname in ('manager_review_parent_reviews','manager_approve_parent_review')");
    assert.equal(fn.length,2);
    assert.ok(fn.every(x=>x.prosecdef===true));
    // Verify the migration can be rerun without duplicate-policy failure.
    await db.exec(migration);
    const {rows:tablesAfter}=await db.query("select count(*)::int as n from pg_tables where schemaname='public' and tablename='academy_parent_reviews'");
    assert.equal(tablesAfter[0].n,1);
  } finally { await db.close(); }
});
