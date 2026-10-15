// No real customer data or credentials. PostgreSQL + private file transport contracts.
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import {pg,testDb} from './postgres-env.mjs';
const owner='1d932391-a77a-4527-9b6d-1d7d4e884b4e';
const bytesByKey=new Map();
const uploadsByUrl=new Map();
globalThis.__testEnv={ADMIN_USER_ID:owner,ADMIN_TEST_PASSWORD:'isolated-workflow-password',DB:testDb,BUCKET:{
 createUploadUrl:async key=>{const signedUrl='https://unit.supabase.co/storage/v1/object/upload/sign/'+key+'?token=test';uploadsByUrl.set(signedUrl,key);return {signedUrl};},
 check:async()=>({private:true}),
 downloadUrl:async(key,name)=>'https://unit.supabase.co/private-download/'+key+'?name='+encodeURIComponent(name),
 get:async key=>bytesByKey.has(key)?{body:bytesByKey.get(key)}:null,
 put:async(key,bytes)=>bytesByKey.set(key,new Uint8Array(bytes)),
 delete:async key=>bytesByKey.delete(key)
}};
globalThis.__testUser={userId:owner};
await esbuild.build({entryPoints:['app/api/[...path]/route.ts'],outfile:'.sites-runtime/deployment-api.mjs',bundle:true,platform:'node',format:'esm'});
const api=await import('../.sites-runtime/deployment-api.mjs');
let cookie='';
async function call(path,body,user=owner){
 if(body&&(/\/invoices$/.test(path)||body.kind==='Facture rectificative'))body={rateDate:'2026-10-14',...body};
 globalThis.__testUser=user?{userId:user}:null;
 const method=body?'POST':'GET';
 const r=await api[method](new Request('https://cargo.test/api/'+path,{method,headers:{cookie,origin:'https://cargo.test',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));
 if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 return {status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('json')?await r.json():null};
}
assert.equal((await call('admin-login',{password:'isolated-workflow-password'})).status,200);
assert.equal((await call('health')).data.privateStorage,true);
assert.equal((await call('health',undefined,null)).status,401);
assert.equal((await call('company',{version:0,data:{name:'Isolated test company',address:'Isolated address'}})).status,200);
const shipment=(await call('shipments',{client:'Isolated client',contact:'client@example.test',item:'Isolated vehicle',category:'Véhicule',origin:'Origin',destination:'Destination',purchaseReference:'EXTERNAL',firstInvoiceReference:'ISOLATED-ONLY'})).data;
const {id,ref,access}=shipment;
const invoice=(await call('shipments/'+id+'/invoices',{base:1000,usdRate:.002,gnfRate:8000,stage:'Transit',reason:'Actual service test',provider:'Test provider',signer:'Test manager',rateSource:'Isolated test rates',requiresPayment:true,serviceAction:'Arrange the agreed service'})).data;
assert.equal((await call('shipments/'+id+'/invoices',{base:1000,usdRate:.002,gnfRate:8000,rateDate:'',rateSource:'Test',reason:'Test',stage:'Test',provider:'Test',signer:'Test'})).status,400);
let track=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(track.services[0].state,'awaiting_payment');
assert.equal((await call('tracking?ref='+ref,undefined,null)).data.services.length,0);
const task=track.services[0];
assert.equal((await call('shipments/'+id+'/service-confirm',{taskId:task.id,version:task.version,source:'Operator confirmation'})).status,409);
assert.equal((await call('shipments/'+id+'/events',{version:0,type:'En transport',place:'Confirmed origin',date:'2026-10-01T08:00:00Z',source:'Transporter confirmation',published:true})).status,200);
assert.equal((await call('tracking?ref='+ref,undefined,null)).data.events.length,1,'Unpaid service never hides confirmed movement');

// A valid 5 MiB PDF bypasses the Vercel function request body entirely.
const file=new Uint8Array(5*1024*1024);file.set(new TextEncoder().encode('%PDF-1.7\n'));
const intent=await call('upload-intent',{invoiceId:invoice.id,access,name:'proof.pdf',mime:'application/pdf',size:file.length},null);
assert.equal(intent.status,200,JSON.stringify(intent.data));
assert.equal((await call('upload-finalize',{id:intent.data.id,access:'forged'},null)).status,403);
bytesByKey.set(uploadsByUrl.get(intent.data.url),file);
const finished=await call('upload-finalize',{id:intent.data.id,access},null);
assert.equal(finished.status,200,JSON.stringify(finished.data));
assert.equal((await call('upload-finalize',{id:intent.data.id,access},null)).status,200);
assert.equal((await testDb.prepare('SELECT count(*) AS n FROM documents WHERE id=?').bind(intent.data.id).first()).n,1);
assert.equal((await call('shipments/'+id)).data.invoices[0].status,'preuve_recue');
track=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(track.services[0].state,'awaiting_payment','A proof does not release the payment gate');
assert.equal((await call('shipments/'+id+'/paid',{invoiceId:invoice.id,verified:true})).status,200);
track=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(track.services[0].state,'ready');
assert.equal((await call('shipments/'+id+'/rectify',{invoiceId:invoice.id,kind:'Facture rectificative',reason:'No double charge',base:1200,usdRate:.002,gnfRate:8000,rateSource:'Test'})).status,409,'A paid invoice cannot create a fresh payment demand automatically');
assert.equal(track.events.length,1,'Payment never invents a movement');
assert.equal((await call('shipments/'+id+'/service-confirm',{taskId:task.id,version:0,source:'Verified provider confirmation'})).status,200);
track=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(track.services[0].state,'confirmed');assert.equal(track.events.length,1);
assert.equal((await call('shipments/'+id+'/service-confirm',{taskId:task.id,version:0,source:'Repeated'})).status,200);
assert.equal((await testDb.prepare("SELECT count(*) AS n FROM audit WHERE action='Prestation prise en charge'").first()).n,1);

const shared=await call('upload-intent',{shipmentId:id,name:'purchase.pdf',mime:'application/pdf',size:12,kind:'Facture d’achat',shared:true});
bytesByKey.set(uploadsByUrl.get(shared.data.url),new TextEncoder().encode('%PDF-1.7\n123'));
assert.equal((await call('upload-finalize',{id:shared.data.id})).status,200);
assert.equal((await call('document/'+shared.data.id,undefined,null)).status,403);
const download=await call('document/'+shared.data.id+'?access='+access,undefined,null);
assert.equal(download.status,303);assert.match(download.headers.get('location'),/^https:\/\/unit.supabase.co\/private-download\//);
assert.equal((await call('document/'+intent.data.id+'?access='+access,undefined,null)).status,403,'Payment proof is internal by default');
const invalid=await call('upload-intent',{shipmentId:id,name:'fake.pdf',mime:'application/pdf',size:12,kind:'Autre'});
bytesByKey.set(uploadsByUrl.get(invalid.data.url),new Uint8Array(12));
assert.equal((await call('upload-finalize',{id:invalid.data.id})).status,400);
const expired=await call('upload-intent',{shipmentId:id,name:'expired.pdf',mime:'application/pdf',size:12,kind:'Autre'});
await testDb.prepare('UPDATE cargo_uploads SET expires=? WHERE id=?').bind('2020-01-01T00:00:00Z',expired.data.id).run();
assert.equal((await call('upload-finalize',{id:expired.data.id})).status,410);
assert.equal((await call('upload-intent',{shipmentId:id,name:'forged.pdf',mime:'application/pdf',size:12},null)).status,403);
assert.equal((await call('upload-intent',{shipmentId:id,name:'oversized.pdf',mime:'application/pdf',size:11*1024*1024})).status,400);
assert.equal((await call('backup')).status,413,'Oversized backups fail explicitly before Vercel response limits');
for(const role of ['anon','authenticated']){
 await pg.exec('set role '+role);
 for(const table of ['cargo_uploads','service_tasks'])await assert.rejects(pg.query('select * from public.'+table));
 await pg.exec('reset role');
}
const amended=(await call('shipments/'+id+'/invoices',{base:1000,usdRate:.002,gnfRate:8000,stage:'Transit',reason:'Correction test',provider:'Test',signer:'Manager',rateSource:'Test source',requiresPayment:true,serviceAction:'Service to correct'})).data;
assert.equal((await call('shipments/'+id+'/rectify',{invoiceId:amended.id,kind:'Facture rectificative',reason:'Correct actual amount',base:900,usdRate:.002,gnfRate:8000,rateSource:'Test source'})).status,200);
track=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(track.services.find(t=>t.invoice_id===amended.id).state,'rectified');
assert.ok(track.services.some(t=>t.invoice_id!==amended.id&&t.action==='Service to correct'&&t.state==='awaiting_payment'));
assert.equal((await call('shipments/'+id+'/document-access',{documentId:shared.data.id,shared:false})).status,200);
assert.equal((await call('document/'+shared.data.id+'?access='+access,undefined,null)).status,403);
assert.equal((await call('shipments/'+id+'/document-access',{documentId:shared.data.id,shared:true})).status,200);
assert.equal((await call('shipments/'+id+'/revoke-link',{})).status,200);
assert.equal((await call('tracking?ref='+ref+'&access='+access,undefined,null)).data.privateAccess,false);
assert.equal((await call('document/'+shared.data.id+'?access='+access,undefined,null)).status,403);

console.log('PASS — deployment workflow: signed 5 MiB private upload, content/expiry/access checks, idempotent finalization, private download redirect, proof versus funds, per-service payment gate, no invented movement, rectification, bounded backup, private new tables.');
await pg.close();
