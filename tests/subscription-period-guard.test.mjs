import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('database guard rejects repeat unpaid periods but preserves paid history and different players', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table public.subscriptions(id text primary key, player_id text not null,
      start_date date not null, end_date date not null, status text not null);
      insert into public.subscriptions values ('old','p1','2026-09-01','2026-09-30','paid');`);
    await db.exec(await read('supabase/migrations/20261011115000_prevent_duplicate_unpaid_subscription_periods.sql'));
    await db.exec(`insert into public.subscriptions values ('new','p1','2026-10-01','2026-11-01','unpaid');`);
    await assert.rejects(db.exec(`insert into public.subscriptions values ('repeat','p1','2026-10-01','2026-11-01','unpaid');`), /already exists/);
    await assert.rejects(db.exec(`insert into public.subscriptions values ('partial','p1','2026-10-15','2026-11-15','unpaid');`), /overlapping/);
    await db.exec(`insert into public.subscriptions values ('other','p2','2026-10-01','2026-11-01','unpaid');`);
    await db.exec(`update public.subscriptions set status='unpaid' where id='new';`);
    const rows = (await db.query('select id,status from public.subscriptions order by id')).rows;
    assert.deepEqual(rows.map(x => x.id), ['new','old','other']);
    assert.equal(rows.find(x => x.id === 'old').status,'paid');
  } finally { await db.close(); }
});
