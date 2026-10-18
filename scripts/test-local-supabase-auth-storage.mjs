import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// This fixture runs ONLY against disposable GitHub Actions Docker Supabase.
// Never accept remote URLs, linked projects, or deployment credentials.
assert.equal(process.env.CI,'true','Only run in isolated GitHub Actions CI');
const output=execFileSync('npx',['--yes','supabase@2','status','-o','env'],{
 encoding:'utf8',env:{...process.env,SUPABASE_ACCESS_TOKEN:''}
});
const settings=Object.fromEntries(output.split(/\r?\n/).map(line=>{
 const i=line.indexOf('=');
 if(i<1)return [null,null];
 return [line.slice(0,i),line.slice(i+1).replace(/^["']|["']$/g,'')];
}).filter(([k])=>k));
const url=settings.API_URL || 'http://127.0.0.1:54321';
assert.match(url,/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const anon=settings.ANON_KEY || settings.PUBLISHABLE_KEY;
const adminKey=settings.SERVICE_ROLE_KEY || settings.SECRET_KEY;
assert.ok(anon && adminKey,'Local-only Supabase keys missing');
const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const token=crypto.randomUUID().slice(0,8);
const password='Local-' + crypto.randomUUID() + '!9';
async function user(n){
 const email=`family-local-${n}-${token}@example.invalid`;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(error)throw error;
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await client.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 assert.equal(result.data.user.id,data.user.id);
 return {client,id:data.user.id};
}
const a=await user('parent-a');
const b=await user('parent-b');
const {data:buckets,error:bucketError}=await admin.storage.listBuckets();
if(bucketError)throw bucketError;
assert.ok(buckets?.some(x=>x.id==='payment-proofs' && x.public===false),
 'Private payment-proofs bucket is required');
const payload=new TextEncoder().encode('%PDF-1.4\nlocal test only\n');
const path=`${a.id}/family/${crypto.randomUUID()}.pdf`;
const own=await a.client.storage.from('payment-proofs').upload(path,payload,{
 contentType:'application/pdf',upsert:false});
assert.equal(own.error,null,'Owner should be allowed to upload own parent-scoped receipt');
const cross=await b.client.storage.from('payment-proofs').download(path);
assert.ok(cross.error,'Unrelated authenticated user must not download another parent receipt');
const forged=await b.client.storage.from('payment-proofs').upload(
 `${a.id}/family/${crypto.randomUUID()}.pdf`,payload,{contentType:'application/pdf'});
assert.ok(forged.error,'Unrelated user must not upload into another parent folder');
// Exercise actual PostgREST RPC authorization using fake local identities.
const fakeReceiptId=crypto.randomUUID();
const unauthenticated=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const anonApproval=await unauthenticated.rpc('approve_family_payment_receipt',{
 p_receipt_id:fakeReceiptId,p_confirmed_amount:25});
assert.ok(anonApproval.error,'Anonymous users must never be able to approve family payments');
const parentApproval=await a.client.rpc('approve_family_payment_receipt',{
 p_receipt_id:fakeReceiptId,p_confirmed_amount:25});
assert.ok(parentApproval.error,'A parent without manager role must not approve payments');
assert.match(parentApproval.error.message,/Manager authorization required|permission denied|not authorized/i);
const nonOwnerSubmission=await b.client.rpc('submit_family_payment_receipt',{
 p_subscription_ids:['not-a-subscription','not-another-subscription'],
 p_proof_path:path,p_transfer_date:'2026-10-18'});
assert.ok(nonOwnerSubmission.error,'Parent cannot attach another parent\'s receipt or invalid subscriptions');
const {data:unauthorizedReceipt,error:adminReadError}=await admin
 .from('family_payment_receipts').select('id').eq('proof_path',path);
assert.equal(adminReadError,null);
assert.equal(unauthorizedReceipt.length,0,'Rejected API attempts must not create a payment batch');
console.log('PASS local Supabase RPC: anonymous/parent approval denied, forged family submission denied, no receipt created');
// Full happy path on disposable local-only data, never on production.
const manager=await user('manager');
const parentId='family-parent-'+token;
const playerIds=['family-player-1-'+token,'family-player-2-'+token];
const subIds=['family-sub-1-'+token,'family-sub-2-'+token];
async function insert(table,records){
 const {error}=await admin.from(table).insert(records);
 if(error)throw new Error(table+': '+error.message);
}
await insert('parents',{id:parentId,name:'Local Parent',user_id:a.id,joined_date:'2026-10-01'});
await insert('players',playerIds.map((id,i)=>({
 id,name:'Local Child '+i,birth_date:'2015-01-01',joined_date:'2026-10-01',parent_id:parentId,team_id:null,status:'inactive',jersey_number:21+i
})));
await insert('subscriptions',subIds.map((id,i)=>({
 id,player_id:playerIds[i],start_date:'2026-10-01',end_date:'2026-10-31',status:'unpaid',amount:i===0?25:20
})));
await insert('staff',{id:'family-manager-'+token,name:'Local Manager',email:'family-manager-'+token+'@example.invalid',
 role:'manager',status:'active',joined_date:'2026-01-01',user_id:manager.id});
const submitted=await a.client.rpc('submit_family_payment_receipt',{
 p_subscription_ids:subIds,p_proof_path:path,p_transfer_date:'2026-10-18'
});
assert.equal(submitted.error,null,'Parent with two own unpaid subscriptions should submit one receipt');
assert.ok(submitted.data,'Family receipt ID required');
const {data:pending,error:pendingError}=await admin.from('family_payment_receipts')
 .select('status,expected_amount').eq('id',submitted.data).single();
assert.equal(pendingError,null);
assert.equal(pending.status,'pending','Submission must never automatically approve');
assert.equal(Number(pending.expected_amount),45);
const review=await manager.client.rpc('review_family_payment_receipt',{
 p_receipt_id:submitted.data,p_decision:'needs_info',p_note:'Please upload a readable receipt'
});
assert.equal(review.error,null,'Manager should request a correction');
const blocked=await manager.client.rpc('approve_family_payment_receipt',{
 p_receipt_id:submitted.data,p_confirmed_amount:45});
assert.ok(blocked.error,'Needs-info receipt cannot be approved');
const replacementPath=`${a.id}/family/${crypto.randomUUID()}.pdf`;
const replacement=await a.client.storage.from('payment-proofs').upload(replacementPath,payload,{
 contentType:'application/pdf',upsert:false});
assert.equal(replacement.error,null);
const foreignResubmit=await b.client.rpc('resubmit_family_payment_receipt',{
 p_receipt_id:submitted.data,p_proof_path:replacementPath,p_transfer_date:'2026-10-18'});
assert.ok(foreignResubmit.error,'Other parent must not correct this family receipt');
const resubmit=await a.client.rpc('resubmit_family_payment_receipt',{
 p_receipt_id:submitted.data,p_proof_path:replacementPath,p_transfer_date:'2026-10-18'});
assert.equal(resubmit.error,null,'Original parent should resubmit a corrected proof');
const {data:history,error:historyError}=await admin.from('family_receipt_review_events')
 .select('action,prior_proof_path,new_proof_path').eq('receipt_id',submitted.data);
assert.equal(historyError,null);
assert.deepEqual(new Set(history.map(e=>e.action)),new Set(['needs_info','resubmitted']));
const oldEvidence=await a.client.storage.from('payment-proofs').remove([path]);
const oldCheck=await admin.storage.from('payment-proofs').download(path);
assert.equal(oldCheck.error,null,'Original proof must be retained in audit history');
const wrongAmount=await manager.client.rpc('approve_family_payment_receipt',{
 p_receipt_id:submitted.data,p_confirmed_amount:25});
assert.ok(wrongAmount.error,'Manager must reject a mismatched bank amount');
const approve=await manager.client.rpc('approve_family_payment_receipt',{
 p_receipt_id:submitted.data,p_confirmed_amount:45});
assert.equal(approve.error,null,'Active local manager should approve exact verified amount');
const retry=await manager.client.rpc('approve_family_payment_receipt',{
 p_receipt_id:submitted.data,p_confirmed_amount:45});
assert.ok(retry.error,'A receipt must not be approved twice');
const {data:subs,error:subsError}=await admin.from('subscriptions').select('id,status')
 .in('id',subIds);
assert.equal(subsError,null);
assert.equal(subs.length,2);
assert.ok(subs.every(x=>x.status==='paid'));
const {data:tx,error:txError}=await admin.from('transactions').select('subscription_id,amount')
 .in('subscription_id',subIds);
assert.equal(txError,null);
assert.equal(tx.length,2,'One ledger entry per child, even after approval retry');
assert.equal(tx.reduce((sum,x)=>sum+Number(x.amount),0),45);
const {data:approved,error:approvedError}=await admin.from('family_payment_receipts')
 .select('status').eq('id',submitted.data).single();
assert.equal(approvedError,null);
assert.equal(approved.status,'approved');
console.log('PASS local family payment: parent submission, pending gate, manager amount validation, atomic approval, two ledger entries, retry denied');
const ownDelete=await a.client.storage.from('payment-proofs').remove([replacementPath]);
// A referenced approved receipt must retain its audit evidence.
// Supabase Storage may return HTTP success with an empty delete result under RLS.
const protectedObject=await admin.storage.from('payment-proofs').download(replacementPath);
assert.equal(protectedObject.error,null,'Approved evidence must still exist after parent deletion attempt');
console.log('PASS approved receipt proof retained despite parent delete request');
console.log('PASS local Supabase Auth/Storage: separate parents, private bucket, upload scope, cross-parent denial and cleanup');
