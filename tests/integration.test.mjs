import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const manager = '00000000-0000-4000-8000-000000000001';
const accountant = '00000000-0000-4000-8000-000000000002';
const receptionist = '00000000-0000-4000-8000-000000000003';
const outsider = '00000000-0000-4000-8000-000000000004';
const parent = '00000000-0000-4000-8000-000000000005';
const role = async uid => {
  await db.exec('reset role');
  await db.query("select set_config('test.uid', $1, false)", [uid]);
  await db.exec('set role authenticated');
};
const row = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const pay = (id, amount = 35, method = 'cash', date = null) => db.query('select (public.record_subscription_payment($1,$2,$3,$4,null)).*', [id, amount, method, date]);
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema internal; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create table storage.objects(bucket_id text, name text, metadata jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema public, auth, internal to authenticated;
  `);
  await db.exec(await read('tests/fixtures/live-tables.sql'));
  await db.exec(await read('tests/fixtures/live-constraints.sql'));
  // Use the actual authorization, audit and validation functions from the migration history.
  await db.exec(await read('supabase/migrations/20260915033418_bind_authorization_strictly_to_auth_user_id.sql'));
  await db.exec(await read('supabase/migrations/20260915065106_harden_academy_admin_requires_active_staff.sql'));
  await db.exec(await read('supabase/migrations/20260915034219_harden_parent_registration_integrity.sql'));
  await db.exec(await read('supabase/migrations/20260914232843_create_safe_subscription_payment_workflow.sql'));
  await db.exec(await read('supabase/migrations/20260915002611_harden_subscription_payment_path.sql'));
  await db.exec(await read('supabase/migrations/20260914232710_tighten_financial_edit_controls.sql'));
  await db.exec(await read('supabase/migrations/20260915004826_strengthen_linked_transaction_integrity.sql'));
  await db.exec(await read('tests/fixtures/live-rpc.sql'));
  // The existing trigger function is loaded below with the migration replacing its body.
  await db.exec(await read('supabase/migrations/20260922095412_add_registration_type_to_applications.sql'));
  // Existing workflow guard and document-promotion trigger; Storage HTTP/RLS is a separate live test.
  await db.exec((await read('supabase/migrations/20260922092138_tighten_registration_approval_and_promote_documents.sql')).split('create policy')[0]);
  await db.exec(await read('supabase/migrations/20260922142529_repair_application_integration.sql'));
  await db.exec(`create trigger trg_guard_player_sensitive_columns before update on public.players for each row execute function internal.guard_player_sensitive_columns();
    create trigger trg_validate_subscription_state before insert or update on public.subscriptions for each row execute function internal.validate_subscription_state();
    create trigger trg_notify_managers_new_registration after insert or update of status on public.registration_applications for each row execute function internal.notify_managers_new_registration();
    alter table public.registration_applications enable row level security;
    alter table public.registration_children enable row level security;
    alter table public.registration_documents enable row level security;
    create policy registration_apps_select on public.registration_applications for select to authenticated using (internal.is_academy_admin() or applicant_user_id=auth.uid());
    create policy registration_apps_update on public.registration_applications for update to authenticated using (internal.is_academy_admin());
    create policy registration_children_select on public.registration_children for select to authenticated using (internal.is_academy_admin() or exists(select 1 from public.registration_applications a where a.id=application_id and a.applicant_user_id=auth.uid()));
    create policy registration_docs_select on public.registration_documents for select to authenticated using (internal.is_academy_admin() or exists(select 1 from public.registration_applications a where a.id=application_id and a.applicant_user_id=auth.uid()));
    alter table public.subscriptions enable row level security;
    alter table public.transactions enable row level security;
    create policy subscriptions_select on public.subscriptions for select to authenticated using (internal.has_role(array['manager','accountant']));
    create policy subscriptions_update on public.subscriptions for update to authenticated using (internal.has_role(array['manager']));
    create policy subscriptions_insert on public.subscriptions for insert to authenticated with check (internal.has_role(array['manager']));
    create policy transactions_select on public.transactions for select to authenticated using (internal.has_role(array['manager','accountant']));
    create policy transactions_update on public.transactions for update to authenticated using (internal.has_role(array['manager']));
    create policy transactions_delete on public.transactions for delete to authenticated using (internal.has_role(array['manager']));
    grant select,insert,update,delete on all tables in schema public to authenticated;
    create unique index uq_registration_child_photo on public.registration_documents(child_id) where file_category='photo';
    create unique index uq_registration_storage_path on public.registration_documents(storage_path);
    insert into auth.users values ('${manager}','manager@example.invalid'),('${accountant}','accountant@example.invalid'),('${receptionist}','reception@example.invalid'),('${outsider}','outsider@example.invalid'),('${parent}','parent@example.invalid');
    insert into public.staff(id,user_id,name,email,role,status,joined_date) values
      ('manager','${manager}','Test manager','manager@example.invalid','manager','active',current_date),
      ('accountant','${accountant}','Test accountant','accountant@example.invalid','accountant','active',current_date),
      ('receptionist','${receptionist}','Test receptionist','reception@example.invalid','receptionist','active',current_date);
    insert into public.parents(id,user_id,name,national_id,email,phone,joined_date) values ('parent','${parent}','Test parent','TEST-PARENT','parent@example.invalid','12345678',current_date);
    insert into public.players(id,name,birth_date,parent_id,team_id,joined_date) values ('child','Test child','2015-01-01','parent',null,current_date);
    insert into public.subscriptions(id,player_id,plan_type,amount,start_date,end_date,status) values
      ('pay','child','monthly',35,'2026-09-01','2026-10-01','unpaid'),
      ('rollback','child','monthly',35,'2026-09-01','2026-10-01','unpaid'),
      ('direct','child','monthly',35,'2026-09-01','2026-10-01','unpaid'),
      ('stale','child','monthly',35,'2026-09-01','2026-10-01','unpaid');
  `);
  await db.exec(await read('supabase/migrations/20260915074609_restrict_sensitive_column_select_grants.sql'));
  await db.exec('grant select(row_version) on public.players,public.parents,public.staff to authenticated');
});
after(() => db.close());

test('unknown, parent, receptionist, anonymous and inactive staff cannot pay', async () => {
  for (const uid of [outsider, parent, receptionist, '']) {
    await role(uid); await assert.rejects(pay('pay'), /Authentication required|Only manager or accountant/);
  }
  await db.exec('reset role');
  await db.exec("update public.staff set status='inactive' where id='accountant'");
  await role(accountant); await assert.rejects(pay('pay'), /Only manager or accountant/);
  await db.exec('reset role'); await db.exec("update public.staff set status='active' where id='accountant'");
});
test('accountant RPC saves typed dates, linked revenue and exactly one audit record', async () => {
  await role(accountant);
  const result = await pay('pay', 35, 'cash', '2026-09-22');
  assert.equal(result.rows[0].subscription_id, 'pay');
  assert.equal(result.rows[0].player_id, 'child');
  const sub = await row("select status, paid_at, row_version from public.subscriptions where id='pay'");
  assert.equal(sub.status, 'paid'); assert.ok(sub.paid_at); assert.equal(Number(sub.row_version), 1);
  assert.equal((await row("select count(*)::int as n from public.audit_logs where action='subscription_payment_recorded'")).n, 1);
});
test('retry is idempotent and conflicting amounts/methods/dates are rejected', async () => {
  await role(accountant);
  const first = (await pay('pay')).rows[0]; const retry = (await pay('pay')).rows[0];
  assert.equal(first.id, retry.id);
  await assert.rejects(pay('pay', 40), /amount must equal/);
  await assert.rejects(pay('pay', 35, 'card'), /already paid/);
  await assert.rejects(pay('pay', 35, 'cash', '2026-02-30'), /out of range/);
  assert.equal((await row("select count(*)::int as n from public.transactions where subscription_id='pay'")).n, 1);
});
test('a downstream failure rolls back subscription, transaction and audit together', async () => {
  await db.exec('reset role');
  await db.exec("alter table public.transactions add constraint fail_test_transaction check(subscription_id is distinct from 'rollback')");
  await role(accountant); await assert.rejects(pay('rollback'), /fail_test_transaction/);
  assert.equal((await row("select status from public.subscriptions where id='rollback'")).status, 'unpaid');
  assert.equal((await row("select count(*)::int as n from public.transactions where subscription_id='rollback'")).n, 0);
  await db.exec('reset role'); await db.exec('alter table public.transactions drop constraint fail_test_transaction');
});
test('even managers cannot break a posted subscription or transaction', async () => {
  await role(manager);
  for (const assignment of ["amount=40", "status='unpaid',payment_method=null,paid_at=null", "player_id='another'", "end_date='2027-01-01'"]) {
    await assert.rejects(db.exec(`update public.subscriptions set ${assignment} where id='pay'`), /Posted subscription/);
  }
  await assert.rejects(db.exec("update public.transactions set amount=40 where subscription_id='pay'"), /Posted subscription/);
  await assert.rejects(db.exec("delete from public.transactions where subscription_id='pay'"), /cannot be deleted/);
  await assert.rejects(db.exec("update public.subscriptions set status='paid',payment_method='cash',paid_at=now() where id='direct'"), /requires its linked/);
  await assert.rejects(db.exec("insert into public.transactions(id,type,category,amount,transaction_date) values('manual','revenue','subscription',35,current_date)"), /Use record_subscription_payment/);
});
test('compare-and-swap rejects stale editors without changing the saved amount', async () => {
  await role(manager);
  const first = await db.query("update public.subscriptions set amount=40 where id='stale' and row_version=0 returning id");
  const stale = await db.query("update public.subscriptions set amount=45 where id='stale' and row_version=0 returning id");
  assert.equal(first.rows.length, 1); assert.equal(stale.rows.length, 0);
  assert.equal(Number((await row("select amount from public.subscriptions where id='stale'")).amount), 40);
});
test('parent edits atomically synchronize child contacts and retain private notes', async () => {
  await role(receptionist);
  await db.exec("update public.parents set name='Updated parent', phone='87654321', email='updated@example.invalid' where id='parent'");
  const child = await row("select parent_name,parent_phone,parent_email,row_version from public.players where id='child'");
  assert.equal(child.parent_name, 'Updated parent'); assert.equal(child.parent_phone, '87654321');
  assert.equal(child.parent_email, 'updated@example.invalid'); assert.equal(Number(child.row_version), 1);
  await db.exec("update public.players set parent_phone='stale-value' where id='child'");
  assert.equal((await row("select parent_phone from public.players where id='child'")).parent_phone, '87654321');
  await assert.rejects(db.exec("update public.players set notes='overwrite' where id='child'"), /private player notes/);
  await assert.rejects(db.exec("update public.parents set national_id='overwrite' where id='parent'"), /parent national ID/);
});
test('draft creation survives retries; other accounts cannot edit it', async () => {
  await role(parent);
  const data = { registrationType: 'initial_onboarding', fullName: 'Test parent', nationalId: 'TEST-PARENT', phone: '12345678', email: 'parent@example.invalid', requestId: '00000000-0000-4000-8000-000000000050' };
  const kids = [{ clientKey: 'kid-1', fullName: 'Child one', nationalId: 'TEST-1', birthDate: '2015-01-01' }, { clientKey: 'kid-2', fullName: 'Child two', nationalId: 'TEST-2', birthDate: '2017-01-01' }];
  const create = () => row('select internal.create_registration_draft($1,$2) as data', [JSON.stringify(data), JSON.stringify(kids)]);
  const first = (await create()).data; const second = (await create()).data;
  assert.equal(first.registrationType, 'initial_onboarding'); assert.equal(second.registrationType, 'initial_onboarding');
  assert.equal((await row('select registration_type from public.registration_applications where id=$1', [first.applicationId])).registration_type, 'initial_onboarding');
  assert.equal(first.applicationId, second.applicationId); assert.equal(first.children.length, 2);
  await role(outsider);
  await assert.rejects(db.query('select public.update_registration_draft($1,$2,$3)', [first.applicationId, JSON.stringify(data), JSON.stringify(kids)]), /access denied/);
  await assert.rejects(db.query('select public.approve_registration_application($1)', [first.applicationId]), /Manager authorization/);
  await role(manager);
  await assert.rejects(db.query('select public.approve_registration_application($1)', [first.applicationId]), /Only submitted/);
});

test('registration: two children, photo requirement, needs-info edit, approval and activation', async () => {
  await role(parent);
  const application = await row('select id from public.registration_applications order by created_at desc limit 1');
  const id = application.id;
  await assert.rejects(db.query('select public.submit_registration_application($1)', [id]), /Every child must have a profile photo/);
  const children = (await db.query('select id from public.registration_children where application_id=$1 order by full_name', [id])).rows;
  for (const child of children) {
    const path = `applications/${id}/${child.id}/photo.jpg`;
    await db.exec('reset role');
    await db.query("insert into storage.objects values ('player-documents',$1,'{\"mimetype\":\"image/jpeg\",\"size\":100}')", [path]);
    await role(parent);
    const sql = "select internal.add_registration_document($1,$2,$3,'photo.jpg','image/jpeg','photo','profile_photo',100) as id";
    const first = await row(sql, [id, child.id, path]); const retry = await row(sql, [id, child.id, path]);
    assert.equal(first.id, retry.id);
  }
  await db.query('select public.submit_registration_application($1)', [id]);
  await role(outsider);
  assert.equal((await db.query('select id from public.registration_applications where id=$1', [id])).rows.length, 0);
  assert.equal((await db.query('select id from public.registration_children where application_id=$1', [id])).rows.length, 0);
  await assert.rejects(db.query('select public.submit_registration_application($1)', [id]), /access denied/);
  await role(manager);
  // The manager's regular table grant still hides CPR; the checked RPC can read it.
  await assert.rejects(db.query('select national_id from public.players'), /permission denied/);
  await db.query("select public.review_registration_application($1,'needs_info','Please complete the notes')", [id]);
  await assert.rejects(db.query('select public.approve_registration_application($1)', [id]), /Only submitted/);
  await role(parent);
  const parentData = { registrationType: 'new_application', fullName: 'Test parent', nationalId: 'TEST-PARENT', phone: '12345678', email: 'parent@example.invalid' };
  const payload = children.map((child, i) => ({ childId: child.id, fullName: `Child ${i + 1}`, nationalId: `TEST-${i + 1}`, birthDate: '2015-01-01', notes: 'Test-only note' }));
  await db.query('select public.update_registration_draft($1,$2,$3)', [id, JSON.stringify(parentData), JSON.stringify(payload)]);
  assert.equal((await row('select registration_type from public.registration_applications where id=$1', [id])).registration_type, 'new_application');
  await db.query('select public.submit_registration_application($1)', [id]);
  await role(manager);
  const approved = (await row('select public.approve_registration_application($1) as data', [id])).data;
  assert.equal((await row('select count(*)::int as n from public.player_documents where player_id = any($1)', [approved.players.map(p => p.playerId)])).n, 2);
  assert.equal(approved.players.length, 2); assert.equal(approved.parentId, 'parent');
  await assert.rejects(db.query('select public.approve_registration_application($1)', [id]), /Only submitted/);
  await db.exec("insert into public.teams(id,name,coach_id) values ('team','Test team','manager')");
  for (let i = 0; i < approved.players.length; i++) {
    const playerId = approved.players[i].playerId;
    assert.equal((await row('select status from public.players where id=$1', [playerId])).status, 'inactive');
    const result = (await row("select public.finalize_registered_player($1,'team','مدافع',$2) as data", [playerId, i + 7])).data;
    assert.equal(result.status, 'active'); assert.equal(result.teamId, 'team');
  }
  await assert.rejects(db.query("select public.finalize_registered_player($1,'team','مدافع',7)", [approved.players[1].playerId]), /Jersey number is already used/);
});
