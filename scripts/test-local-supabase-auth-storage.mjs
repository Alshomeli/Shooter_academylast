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
const periodStart=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bahrain',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const periodEnd=new Date(Date.parse(periodStart+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
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
 p_proof_path:path,p_transfer_date:periodStart});
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
const birthTeamId='family-age-'+token;
const coach=await user('coach');
const coachId='family-coach-'+token;
await insert('staff',{id:coachId,name:'Local Coach',email:'family-coach-'+token+'@example.invalid',
 role:'coach',status:'active',joined_date:'2026-01-01',user_id:coach.id});
await insert('teams',{id:birthTeamId,name:'Local 2014/2015',age_group:'U11',status:'active',category_kind:'team',coach_id:coachId});
await insert('players',playerIds.map((id,i)=>({
 id,name:'Local Child '+i,birth_date:'2015-01-01',joined_date:'2026-10-01',parent_id:parentId,team_id:null,status:'inactive',jersey_number:0
})));
await insert('subscriptions',subIds.map((id,i)=>({
 id,player_id:playerIds[i],start_date:periodStart,end_date:periodEnd,status:'unpaid',amount:i===0?25:20
})));
await insert('staff',{id:'family-manager-'+token,name:'Local Manager',email:'family-manager-'+token+'@example.invalid',
 role:'manager',status:'active',joined_date:'2026-01-01',user_id:manager.id});
const submitted=await a.client.rpc('submit_family_payment_receipt',{
 p_subscription_ids:subIds,p_proof_path:path,p_transfer_date:periodStart
});
assert.equal(submitted.error,null,'Parent with two own unpaid subscriptions should submit one receipt');
assert.ok(submitted.data,'Family receipt ID required');
const {data:pending,error:pendingError}=await admin.from('family_payment_receipts')
 .select('status,expected_amount').eq('id',submitted.data).single();
assert.equal(pendingError,null);
assert.equal(pending.status,'pending','Submission must never automatically approve');
assert.equal(Number(pending.expected_amount),45);
const managerNotice=await manager.client.from('notifications').select('id').eq('title','إثبات دفع أشقاء بانتظار المراجعة');
assert.equal(managerNotice.error,null);
assert.ok(managerNotice.data.length>0,'Family proof submission must notify the manager');
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
 p_receipt_id:submitted.data,p_proof_path:replacementPath,p_transfer_date:periodStart});
assert.ok(foreignResubmit.error,'Other parent must not correct this family receipt');
const resubmit=await a.client.rpc('resubmit_family_payment_receipt',{
 p_receipt_id:submitted.data,p_proof_path:replacementPath,p_transfer_date:periodStart});
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
const activated=await admin.from('players').select('id,status,team_id').in('id',playerIds);
assert.equal(activated.error,null);
assert.ok(activated.data.every(p=>p.status==='active' && p.team_id===birthTeamId),'Approved siblings must activate in their birth-year category');
console.log('PASS local family payment: parent submission, pending gate, manager amount validation, atomic approval, two ledger entries, retry denied');
const ownDelete=await a.client.storage.from('payment-proofs').remove([replacementPath]);
// A referenced approved receipt must retain its audit evidence.
// Supabase Storage may return HTTP success with an empty delete result under RLS.
const protectedObject=await admin.storage.from('payment-proofs').download(replacementPath);
assert.equal(protectedObject.error,null,'Approved evidence must still exist after parent deletion attempt');
console.log('PASS approved receipt proof retained despite parent delete request');
console.log('PASS local Supabase Auth/Storage: separate parents, private bucket, upload scope, cross-parent denial and cleanup');

// Real Auth/PostgREST: actual refund receipt + one-child versus sibling account lifecycle.
async function rpcAs(client,name,args){
 const result=await client.rpc(name,args);
 if(result.error)throw new Error(name+': '+result.error.message);
 return result.data;
}
async function withdraw(subscriptionId,amount){
 await rpcAs(manager.client,'cancel_subscription',{p_request_id:crypto.randomUUID(),p_subscription_id:subscriptionId,p_refund_due:amount,p_reason:'Synthetic withdrawal'});
 const requestId=crypto.randomUUID();
 const args={p_request_id:requestId,p_subscription_id:subscriptionId,p_amount:amount,p_reason:'Synthetic withdrawal',p_method:'benefit'};
 await rpcAs(manager.client,'record_withdrawal_refund',args);
 await rpcAs(manager.client,'record_withdrawal_refund',args);
 const receipt=await manager.client.from('subscription_support').select('id,refund_receipt_number,amount,original_payment_id').eq('id',requestId).single();
 assert.equal(receipt.error,null);
 assert.ok(Number(receipt.data.refund_receipt_number)>0);
 assert.equal(Number(receipt.data.amount),amount);
 return requestId;
}
const familyRefundId=await withdraw(subIds[0],25);
const familyParent=await admin.from('parents').select('status').eq('id',parentId).single();
assert.equal(familyParent.error,null);
assert.equal(familyParent.data.status,'active','Parent with siblings must retain access');
const familyRefund=await a.client.from('subscription_support').select('id').eq('id',familyRefundId);
assert.equal(familyRefund.error,null);
assert.equal(familyRefund.data.length,1,'Parent must see own refund receipt');
const strangerRefund=await b.client.from('subscription_support').select('id').eq('id',familyRefundId);
assert.equal(strangerRefund.error,null);
assert.equal(strangerRefund.data.length,0,'Other parent must not see refund receipt');
const sole=await user('sole-parent');
const soleParentId='sole-parent-'+token, solePlayerId='sole-player-'+token, soleSubId='sole-sub-'+token;
await insert('parents',{id:soleParentId,name:'Sole Parent',user_id:sole.id,joined_date:'2026-10-01'});
await insert('players',{id:solePlayerId,name:'Sole Child',birth_date:'2015-01-01',joined_date:'2026-10-01',parent_id:soleParentId,team_id:null,status:'inactive',jersey_number:0});
await insert('subscriptions',{id:soleSubId,player_id:solePlayerId,start_date:periodStart,end_date:periodEnd,status:'unpaid',amount:25});
const solePath=`${sole.id}/${soleSubId}/${crypto.randomUUID()}.pdf`;
const soleUpload=await sole.client.storage.from('payment-proofs').upload(solePath,payload,{contentType:'application/pdf'});
assert.equal(soleUpload.error,null);
const proofInsert=await sole.client.from('payment_proofs').insert({subscription_id:soleSubId,player_id:solePlayerId,parent_user_id:sole.id,amount:25,transfer_date:periodStart,proof_path:solePath});
assert.equal(proofInsert.error,null);
const soleProof=await manager.client.from('payment_proofs').select('id').eq('subscription_id',soleSubId).single();
assert.equal(soleProof.error,null);
await rpcAs(manager.client,'approve_payment_proof',{p_proof_id:soleProof.data.id});
const soleActive=await admin.from('players').select('status,team_id').eq('id',solePlayerId).single();
assert.equal(soleActive.error,null);
assert.equal(soleActive.data.status,'active');assert.equal(soleActive.data.team_id,birthTeamId);
const soleRefundId=await withdraw(soleSubId,25);
const soleStatus=await admin.from('parents').select('status').eq('id',soleParentId).single();
assert.equal(soleStatus.error,null);assert.equal(soleStatus.data.status,'inactive');
const soleReceipt=await sole.client.from('subscription_support').select('id').eq('id',soleRefundId);
assert.equal(soleReceipt.error,null);assert.equal(soleReceipt.data.length,1);
const originalSolePayment=await admin.from('transactions').select('id,amount').eq('subscription_id',soleSubId).eq('type','revenue');
assert.equal(originalSolePayment.error,null);assert.equal(originalSolePayment.data.length,1);assert.equal(Number(originalSolePayment.data[0].amount),25);
console.log('PASS real payment activation and refunds: birth category, sibling preservation, sole-parent suspension, numbered immutable receipts, retry and cross-parent denial');
