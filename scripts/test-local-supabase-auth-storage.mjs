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
const ownDelete=await a.client.storage.from('payment-proofs').remove([path]);
assert.equal(ownDelete.error,null,'Unsubmitted own file should be removable');
console.log('PASS local Supabase Auth/Storage: separate parents, private bucket, upload scope, cross-parent denial and cleanup');
