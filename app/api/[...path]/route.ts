import {backupRoute} from '../../backup';
import {businessRoutes,getDetails,detailData,companyData,documentKinds,unpack} from '../../business';
import {sendPending} from '../../notifier';
import {invoicePdf,orderPdf} from '../../invoice-pdf';
import { runtimeEnv as env } from '@/lib/runtime';
import { getAdminUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { clean,eventTypes,statusFromEvents,validActualDate } from '../../domain';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function handle(req:Request){
 const runtime=env as any;
 const url=new URL(req.url),p=url.pathname.split('/').filter(Boolean).slice(1);
 if(p[0]==='status'&&req.method==='GET'){
  const sc=isSupabaseConfigured();
  return json({configured:sc||!!(globalThis as any).__testEnv,supabaseConfigured:sc,mapsConfigured:true,emailConfigured:Boolean(runtime.EMAIL_API_KEY?.trim()&&runtime.EMAIL_FROM?.trim()),missingVars:[!process.env.NEXT_PUBLIC_SUPABASE_URL?'NEXT_PUBLIC_SUPABASE_URL':null,!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?'NEXT_PUBLIC_SUPABASE_ANON_KEY':null,!process.env.SUPABASE_SERVICE_ROLE_KEY?'SUPABASE_SERVICE_ROLE_KEY':null].filter(Boolean)});
 }
 const db=env.DB;if(!db)return json({error:'Configuration Supabase requise. Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',setupRequired:true},503);
 const user=await getAdminUser(),owner=user?.userId;
 if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)return json({error:'Requête non autorisée.'},403);
 if(p[0]==='admin-login'&&req.method==='POST'){
  const b=await req.json() as any;
  if(!runtime.ADMIN_TEST_PASSWORD)return json({error:'Mot de passe de gestion non configuré.'},503);
  if(await hash(clean(b.password,200))!==await hash(runtime.ADMIN_TEST_PASSWORD))return json({error:'Mot de passe incorrect.'},403);
  const secret=token(),sessionOwner=owner||'admin';
  await db.prepare('INSERT INTO admin_sessions (id,owner,expires) VALUES (?,?,?)').bind(await hash(secret+runtime.ADMIN_TEST_PASSWORD),sessionOwner,new Date(Date.now()+4*3600000).toISOString()).run();
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`kc_admin=${secret}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`}});
 }
 if(p[0]==='admin-logout'&&req.method==='POST'){
  const cookie=(req.headers.get('cookie')||'').match(/(?:^|;\s*)kc_admin=([a-f0-9]{48})(?:;|$)/)?.[1];
  if(owner&&cookie)await db.prepare('DELETE FROM admin_sessions WHERE id=? AND owner=?').bind(await hash(cookie+runtime.ADMIN_TEST_PASSWORD),owner).run();
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':'kc_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
 }
 if(p[0]==='config'&&req.method==='GET'){
  const ref=clean(url.searchParams.get('ref'),60);const target:any=ref?await db.prepare('SELECT owner FROM shipments WHERE ref=?').bind(ref).first():null;
  const selectedOwner=target?.owner||owner;const cfg:any=selectedOwner?await db.prepare('SELECT maps_key,maps_id,tile_url,tile_attribution FROM settings WHERE owner=?').bind(selectedOwner).first():null;
  return json({
    tileUrl:cfg?.tile_url||runtime.MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:cfg?.tile_attribution||runtime.MAP_TILE_ATTRIBUTION||'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    mapsKey:cfg?.maps_key||runtime.GOOGLE_MAPS_API_KEY||'',
    mapId:cfg?.maps_id||runtime.GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID'
  });
 }
 if(p[0]==='tracking'&&req.method==='GET'){
  const ref=clean(url.searchParams.get('ref'),60).toUpperCase();if(!/^KC-[A-F0-9]{16}$/.test(ref))return json({error:'Aucun dossier trouvé. Vérifiez votre référence.'},404);
  const s:any=await db.prepare('SELECT * FROM shipments WHERE ref=?').bind(ref).first();if(!s)return json({error:'Aucun dossier trouvé. Vérifiez votre référence.'},404);
  const access=url.searchParams.get('access')||'',privateAccess=s.owner===owner||(access&&s.token_hash===await hash(access)&&s.token_expiry>now());
  const rawEvents=(await db.prepare('SELECT id,type,place,date,note,planned,published,created,published_at,lat,lng,mode FROM events WHERE shipment_id=? AND published=1 ORDER BY date,created').bind(s.id).all()).results;
  const events=rawEvents.map((e:any)=>({...e,note:privateAccess?e.note:''}));
  const extra=privateAccess?await getDetails(db,s.id):{};
  const documents=privateAccess?(await db.prepare('SELECT d.id,d.name,d.mime,d.size,d.created,dd.kind FROM documents d LEFT JOIN document_details dd ON dd.document_id=d.id WHERE d.shipment_id=? AND d.shared=1 ORDER BY created DESC').bind(s.id).all()).results:[];
  const notices=privateAccess?(await db.prepare('SELECT id,title,body,created FROM notifications WHERE shipment_id=? ORDER BY created DESC LIMIT 30').bind(s.id).all()).results:[];
  const invoices=privateAccess?(await db.prepare('SELECT id,number,reason,stage,provider,signer,usd,gnf,gnf_rate,rate_source,status,created FROM invoices WHERE shipment_id=? ORDER BY created').bind(s.id).all()).results:[];
  const corrections=privateAccess?(await db.prepare('SELECT c.id,c.invoice_id,c.data,c.created FROM invoice_corrections c JOIN invoices i ON i.id=c.invoice_id WHERE i.shipment_id=?').bind(s.id).all()).results.map((c:any)=>({...c,data:unpack(c.data)})):[];
  return json({notices,invoices,corrections,extra,shipment:{ref:s.ref,origin:s.origin,destination:s.destination,status:s.status,eta:s.eta,updated:s.updated,...(privateAccess?{id:s.id,item:s.item,category:s.category,client:s.client,container:s.container,delivery:s.delivery,orderUsd:s.order_usd,orderGnf:s.order_gnf}:{})},events,documents,privateAccess:!!privateAccess});
 }
 if(p[0]==='order'&&req.method==='GET'){
  const s:any=await db.prepare('SELECT * FROM shipments WHERE ref=?').bind(clean(p[1],60).toUpperCase()).first();const a=url.searchParams.get('access')||'';
  if(!s||!(s.owner===owner||(a&&s.token_hash===await hash(a)&&s.token_expiry>now())))return json({error:'Accès refusé.'},403);
  return new Response(await orderPdf({...s,extra:await getDetails(db,s.id),issuer:await companyData(db,s.owner)}) as any,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="BC-${s.ref}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(p[0]==='invoice'&&req.method==='GET'){
  const i:any=await db.prepare('SELECT * FROM invoices WHERE id=?').bind(p[1]).first();if(!i)return json({error:'Facture introuvable.'},404);
  const s:any=await db.prepare('SELECT * FROM shipments WHERE id=?').bind(i.shipment_id).first();const a=url.searchParams.get('access')||'';
  if(!s||!(s.owner===owner||(a&&s.token_hash===await hash(a)&&s.token_expiry>now())))return json({error:'Accès refusé.'},403);
  const bytes=await invoicePdf(s,{...i,...unpack(i.metadata),issuer:unpack(i.metadata).issuer||await companyData(db,s.owner)});return new Response(bytes as any,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${i.number}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(p[0]==='rectification'&&req.method==='GET'){
  const c:any=await db.prepare('SELECT c.*,i.shipment_id,i.number FROM invoice_corrections c JOIN invoices i ON i.id=c.invoice_id WHERE c.id=?').bind(p[1]).first();if(!c)return json({error:'Rectification introuvable.'},404);
  const s:any=await db.prepare('SELECT * FROM shipments WHERE id=?').bind(c.shipment_id).first(),a=url.searchParams.get('access')||'';if(!(s.owner===owner||(a&&s.token_hash===await hash(a)&&s.token_expiry>now())))return json({error:'Accès refusé.'},403);
  const d=unpack(c.data);return new Response(await invoicePdf(s,{...d,number:d.number,created:c.created,status:'rectificatif',rectifies:c.number}) as any,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${d.number}.pdf"`,'Cache-Control':'no-store'}});
 }
 if(p[0]==='receipt'&&req.method==='POST'){
  const form=await req.formData(),i:any=await db.prepare('SELECT * FROM invoices WHERE id=?').bind(p[1]).first();if(!i)return json({error:'Facture introuvable.'},404);
  const s:any=await db.prepare('SELECT * FROM shipments WHERE id=? AND ref=?').bind(i.shipment_id,clean(form.get('ref'),60)).first(),a=clean(form.get('access'),100);
  if(!s||!(s.owner===owner||(a&&s.token_hash===await hash(a)&&s.token_expiry>now())))return json({error:'Accès refusé.'},403);
  if(await db.prepare('SELECT id FROM invoice_corrections WHERE invoice_id=?').bind(i.id).first())return json({error:'Facture rectifiée : contactez l’agence.'},409);
  if(i.status==='paye')return json({error:'Cette facture est déjà réglée.'},409);
  const file=form.get('file');if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)return json({error:'PDF, JPG ou PNG de moins de 10 Mo requis.'},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),sig=Array.from(bytes.slice(0,8)).map(x=>x.toString(16).padStart(2,'0')).join(''),mime=sig.startsWith('25504446')?'application/pdf':sig.startsWith('ffd8ff')?'image/jpeg':sig.startsWith('89504e470d0a1a0a')?'image/png':'';
  if(!mime||!env.BUCKET)return json({error:'Format refusé ou stockage indisponible.'},400);const fid=uuid(),key=s.owner+'/'+s.id+'/'+fid;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{await db.batch([db.prepare('INSERT INTO documents (id,shipment_id,name,key,mime,size,shared,created) VALUES (?,?,?,?,?,?,0,?)').bind(fid,s.id,'Preuve '+i.number+' '+clean(file.name,100),key,mime,file.size,now()),db.prepare("UPDATE invoices SET status='preuve_recue' WHERE id=? AND status<>'paye'").bind(i.id),db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),s.owner,s.id,'Preuve de paiement reçue','La preuve pour la facture '+i.number+' est reçue. Votre agence doit encore vérifier le paiement.',now(),'non_configure'),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),s.owner,s.id,'Preuve de paiement reçue',i.number,now())]);}catch(e){await env.BUCKET.delete(key);throw e;}
  await sendPending(db,runtime,s.owner,s.id);return json({ok:true});
 }
 if(p[0]==='document'&&req.method==='GET'){
  const d:any=await db.prepare('SELECT d.*,s.owner,s.token_hash,s.token_expiry FROM documents d JOIN shipments s ON s.id=d.shipment_id WHERE d.id=?').bind(p[1]).first();if(!d)return json({error:'Document indisponible.'},404);
  const access=url.searchParams.get('access')||'';if(d.owner!==owner&&!(d.shared&&access&&d.token_hash===await hash(access)&&d.token_expiry>now()))return json({error:'Accès refusé. Votre lien privé peut avoir expiré.'},403);
  const file=await env.BUCKET?.get(d.key);if(!file)return json({error:'Document indisponible.'},404);
  return new Response(file.body,{headers:{'Content-Type':d.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }
 if(!owner)return json({error:'Connectez-vous pour ouvrir votre espace de gestion.'},401);
 if(p[0]==='requests'&&req.method==='POST'){
  const b=await req.json() as any;for(const f of ['name','contact','origin','destination','category'])if(!clean(b[f]))return json({error:'Renseignez les champs obligatoires.'},400);
  const id=uuid();await db.prepare('INSERT INTO requests (id,owner,name,contact,origin,destination,category,note,created) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,owner,clean(b.name),clean(b.contact),clean(b.origin),clean(b.destination),clean(b.category),clean([b.note,b.deliveryAddress?'Remise : '+clean(b.deliveryAddress):'',b.deliveryCountry?'Pays/ville : '+clean(b.deliveryCountry):'',b.deliverySlot?'Créneau : '+clean(b.deliverySlot):''].filter(Boolean).join(' • '),1500),now()).run();return json({id},201);
 }
 {
  const cookie=(req.headers.get('cookie')||'').match(/(?:^|;\s*)kc_admin=([a-f0-9]{48})(?:;|$)/)?.[1];
  const session=cookie?await db.prepare('SELECT id FROM admin_sessions WHERE id=? AND owner=? AND expires>?').bind(await hash(cookie+runtime.ADMIN_TEST_PASSWORD),owner,now()).first():null;
  if(!session)return json({error:'Ouvrez la gestion avec votre mot de passe.'},401);
 }
 if(p[0]==='backup')return backupRoute(req,db,env.BUCKET,owner);
 const business=await businessRoutes(req,p,db,owner,runtime);if(business)return business;
 if(p[0]==='requests'&&req.method==='GET')return json((await db.prepare('SELECT * FROM requests WHERE owner=? ORDER BY created DESC').bind(owner).all()).results);
 if(p[0]==='settings'){
  if(req.method==='GET')return json(await db.prepare('SELECT maps_key,maps_id,tile_url,tile_attribution FROM settings WHERE owner=?').bind(owner).first()||{maps_key:'',maps_id:'',tile_url:'',tile_attribution:''});
  const b=await req.json() as any;
  await db.prepare('INSERT INTO settings (id,owner,maps_key,maps_id,tile_url,tile_attribution) VALUES (?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET maps_key=excluded.maps_key,maps_id=excluded.maps_id,tile_url=excluded.tile_url,tile_attribution=excluded.tile_attribution').bind(owner,owner,clean(b.maps_key,100),clean(b.maps_id,100),clean(b.tile_url,255),clean(b.tile_attribution,255)).run();return json({ok:true});
 }
 if(p[0]==='export'&&req.method==='GET')return json({version:1,shipments:(await db.prepare('SELECT * FROM shipments WHERE owner=?').bind(owner).all()).results.map((x:any)=>{const{token_hash,token_expiry,...rest}=x;return rest;}),events:(await db.prepare('SELECT e.* FROM events e JOIN shipments s ON s.id=e.shipment_id WHERE s.owner=?').bind(owner).all()).results,invoices:(await db.prepare('SELECT i.* FROM invoices i JOIN shipments s ON s.id=i.shipment_id WHERE s.owner=?').bind(owner).all()).results});
 if(p[0]==='audit'&&req.method==='GET')return json((await db.prepare('SELECT a.action,a.detail,a.created,s.ref FROM audit a LEFT JOIN shipments s ON s.id=a.shipment_id WHERE a.owner=? ORDER BY a.created DESC LIMIT 100').bind(owner).all()).results);
 if(p[0]==='shipments'&&p.length===1){
  if(req.method==='GET')return json((await db.prepare('SELECT id,ref,client,contact,item,category,origin,destination,container,email,delivery,eta,status,created,updated,version,(SELECT COUNT(*) FROM invoices WHERE shipment_id=shipments.id AND status=\'preuve_recue\') AS proof_count FROM shipments WHERE owner=? ORDER BY updated DESC LIMIT 500').bind(owner).all()).results);
  const b=await req.json() as any;if(b.email&&!/^\S+@\S+\.\S+$/.test(b.email))return json({error:'Courriel invalide.'},400);for(const f of ['client','contact','item','category','origin','destination','purchaseReference','firstInvoiceReference'])if(!clean(b[f]))return json({error:'Renseignez les champs obligatoires.'},400);
  if(b.eta&&!Number.isFinite(Date.parse(b.eta)))return json({error:'Estimation invalide.'},400);
  const vb=Number(b.vehicleBase),vr=Number(b.vehicleUsdRate),vg=Number(b.vehicleGnfRate),hasPrice=!!(b.vehicleBase||b.vehicleUsdRate||b.vehicleGnfRate);
  if(hasPrice&&![vb,vr,vg].every(v=>Number.isFinite(v)&&v>0))return json({error:'Renseignez le prix du véhicule et les deux taux positifs, ou laissez les trois champs vides.'},400);
  const orderUsd=hasPrice?Math.round(vb*vr*100)/100:null,orderGnf=hasPrice?Math.round(Number(orderUsd)*vg):null;if(hasPrice&&(!Number.isFinite(orderUsd)||!Number.isFinite(orderGnf)||Number(orderUsd)<=0||Number(orderGnf)<=0||Number(orderUsd)>1e12||Number(orderGnf)>9e15))return json({error:'Montant converti hors limites.'},400);
  let extra:any;try{extra=detailData(b);}catch(e:any){return json({error:e.message},400);}
  if(extra.firstInvoiceReference){const prior=await db.prepare("SELECT sd.shipment_id FROM shipment_details sd JOIN shipments s ON s.id=sd.shipment_id WHERE s.owner=? AND json_extract(sd.data,'$.firstInvoiceReference')=? AND s.client=? AND s.item=?").bind(owner,extra.firstInvoiceReference,clean(b.client),clean(b.item)).first();if(prior)return json({error:'Un dossier existe déjà pour cette facture et ce client.'},409);}
  const id=uuid(),ref='KC-'+token().slice(0,16).toUpperCase(),date=now(),secret=token(),expiry=new Date(Date.now()+7*86400000).toISOString();
  await db.batch([db.prepare('INSERT INTO shipments (id,owner,ref,client,contact,item,category,origin,destination,container,eta,status,token_hash,token_expiry,created,updated,email,delivery,vehicle_xaf,order_usd,order_gnf,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)').bind(id,owner,ref,clean(b.client),clean(b.contact),clean(b.item),clean(b.category),clean(b.origin),clean(b.destination),clean(b.container),clean(b.eta),'Enregistré',await hash(secret),expiry,date,date,clean(b.email),clean(b.delivery),hasPrice?vb:null,orderUsd,orderGnf),db.prepare('INSERT INTO shipment_details VALUES (?,?,?)').bind(id,JSON.stringify(extra),date),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Dossier créé',ref,date)]);return json({id,ref,access:secret,expiry},201);
 }
 if(p[0]!=='shipments'||!p[1])return json({error:'Action inconnue.'},404);
 const id=p[1],s:any=await db.prepare('SELECT * FROM shipments WHERE id=? AND owner=?').bind(id,owner).first();if(!s)return json({error:'Accès refusé.'},403);
 if(p.length===2&&req.method==='GET'){const {token_hash,token_expiry,...shipment}=s;return json({extra:await getDetails(db,id),corrections:(await db.prepare('SELECT c.* FROM invoice_corrections c JOIN invoices i ON i.id=c.invoice_id WHERE i.shipment_id=?').bind(id).all()).results.map((c:any)=>({...c,data:unpack(c.data)})),invoices:(await db.prepare('SELECT * FROM invoices WHERE shipment_id=? ORDER BY created DESC').bind(id).all()).results,notices:(await db.prepare('SELECT * FROM notifications WHERE shipment_id=? ORDER BY created DESC LIMIT 30').bind(id).all()).results,shipment,events:(await db.prepare('SELECT * FROM events WHERE shipment_id=? ORDER BY date DESC,created DESC').bind(id).all()).results,documents:(await db.prepare('SELECT d.id,d.name,d.mime,d.size,d.shared,d.created,dd.kind FROM documents d LEFT JOIN document_details dd ON dd.document_id=d.id WHERE d.shipment_id=? ORDER BY created DESC').bind(id).all()).results});}
 if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405);
 if(p[2]==='update'){
  const b=await req.json() as any;for(const f of ['client','contact','item','origin','destination'])if(!clean(b[f]))return json({error:'Renseignez les champs obligatoires.'},400);
  if(b.email&&!/^\S+@\S+\.\S+$/.test(b.email))return json({error:'Courriel invalide.'},400);if(Number(b.version)!==s.version)return json({error:'Dossier modifié. Actualisez avant de corriger.'},409);
  const revoke=clean(b.contact)!==s.contact||clean(b.email)!==s.email;
  const res=await db.batch([db.prepare('UPDATE shipments SET client=?,contact=?,email=?,item=?,origin=?,destination=?,container=?,delivery=?,token_hash=?,token_expiry=?,version=version+1 WHERE id=? AND version=?').bind(clean(b.client),clean(b.contact),clean(b.email),clean(b.item),clean(b.origin),clean(b.destination),clean(b.container),clean(b.delivery),revoke?'':s.token_hash,revoke?'':s.token_expiry,id,s.version),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(uuid(),owner,id,'Dossier corrigé',JSON.stringify({before:{client:s.client,item:s.item,origin:s.origin,destination:s.destination,delivery:s.delivery,orderUsd:s.order_usd,orderGnf:s.order_gnf},after:{client:clean(b.client),item:clean(b.item),origin:clean(b.origin),destination:clean(b.destination),delivery:clean(b.delivery)},linkRevoked:revoke}),now())]);if(!res[0].meta.changes)return json({error:'Modification concurrente. Actualisez.'},409);return json({ok:true,linkRevoked:revoke});
 }
 if(p[2]==='notify'){
  const b=await req.json() as any;if(!clean(b.title)||!clean(b.body))return json({error:'Renseignez le titre et le message.'},400);
  await db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,clean(b.title,150),clean(b.body,1500),now(),'non_configure').run();await sendPending(db,runtime,owner,id);return json({ok:true});
 }
 if(p[2]==='retry-mail'){await sendPending(db,runtime,owner,id);return json({ok:true});}
 if(p[2]==='invoices'){
  const b=await req.json() as any,base=Number(b.base),ur=Number(b.usdRate),gr=Number(b.gnfRate);
  if(![base,ur,gr].every(v=>Number.isFinite(v)&&v>0)||!clean(b.reason)||!clean(b.stage)||!clean(b.provider)||!clean(b.signer)||!clean(b.rateSource))return json({error:'Montant, taux, source, prestation et signataire réel sont obligatoires.'},400);
  if(b.serviceId&&!await db.prepare('SELECT id FROM admin_models WHERE id=? AND owner=? AND kind=?').bind(clean(b.serviceId),owner,'service').first())return json({error:'Prestation inaccessible.'},403);
  const issuer=await companyData(db,owner);if(!issuer.name||!issuer.address)return json({error:'Complétez l’identité réelle et l’adresse de l’entreprise dans Entreprise avant émission.'},400);const justification=clean(b.justificationDocument);if(justification&&!await db.prepare('SELECT id FROM documents WHERE id=? AND shipment_id=?').bind(justification,id).first())return json({error:'Justificatif inaccessible.'},403);const metadata=JSON.stringify({issuer,instructions:issuer.paymentInstructions||'',category:clean(b.serviceCategory),justificationDocument:justification,rateDate:clean(b.rateDate),serviceId:clean(b.serviceId)});
  const iid=uuid(),number='TD-'+new Date().getUTCFullYear()+'-'+token().slice(0,10).toUpperCase(),created=now(),usd=Math.round(base*ur*100)/100,gnf=Math.round(usd*gr);if(!Number.isFinite(usd)||!Number.isFinite(gnf)||usd<=0||gnf<=0||usd>1e12||gnf>9e15)return json({error:'Montant converti hors limites.'},400);
  await db.batch([db.prepare('INSERT INTO invoices (id,shipment_id,number,reason,stage,provider,signer,base_xaf,usd_rate,gnf_rate,rate_source,metadata,usd,gnf,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(iid,id,number,clean(b.reason,1000),clean(b.stage),clean(b.provider),clean(b.signer),base,ur,gr,clean(b.rateSource),metadata,usd,gnf,'a_regler',created),db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,'Facture disponible',`Une facture pour ${clean(b.reason)} est disponible : ${usd} USD, soit ${gnf} GNF. Consultez le PDF et contactez votre agence pour les instructions de paiement.`,created,'non_configure'),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Facture émise',number,created)]);await sendPending(db,runtime,owner,id);return json({ok:true,id:iid});
 }
 if(p[2]==='rectify'){
  const b:any=await req.json(),i:any=await db.prepare('SELECT * FROM invoices WHERE id=? AND shipment_id=?').bind(b.invoiceId,id).first();if(!i)return json({error:'Facture introuvable.'},404);
  if(!clean(b.reason)||!['Avoir intégral','Facture rectificative'].includes(b.kind))return json({error:'Type et motif de rectification requis.'},400);
  if(await db.prepare('SELECT id FROM invoice_corrections WHERE invoice_id=?').bind(i.id).first())return json({error:'Cette facture dispose déjà d’un document rectificatif.'},409);
  const base=b.kind==='Avoir intégral'?i.base_xaf:Number(b.base),ur=b.kind==='Avoir intégral'?i.usd_rate:Number(b.usdRate),gr=b.kind==='Avoir intégral'?i.gnf_rate:Number(b.gnfRate);if(![base,ur,gr].every(x=>Number.isFinite(x)&&x>0)||!clean(b.rateSource||i.rate_source))return json({error:'Montant et taux invalides.'},400);
  const cid=uuid(),replacementInvoiceId=b.kind==='Facture rectificative'?uuid():null,created=now(),usd=Math.round(base*ur*100)/100,gnf=Math.round(usd*gr),data={replacementInvoiceId,kind:b.kind,number:'TD-R-'+token().slice(0,10).toUpperCase(),reason:clean(b.reason,1000),stage:i.stage,provider:i.provider,signer:clean(b.signer)||i.signer,usd,gnf,gnf_rate:gr,rate_source:clean(b.rateSource)||i.rate_source,issuer:unpack(i.metadata).issuer||await companyData(db,owner),instructions:unpack(i.metadata).instructions,originalStatus:i.status};if(!Number.isFinite(usd)||!Number.isFinite(gnf)||usd<=0||gnf<=0||usd>1e12||gnf>9e15)return json({error:'Montant converti hors limites.'},400);
  const replacement=replacementInvoiceId?[db.prepare('INSERT INTO invoices (id,shipment_id,number,reason,stage,provider,signer,base_xaf,usd_rate,gnf_rate,rate_source,metadata,usd,gnf,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(replacementInvoiceId,id,data.number,data.reason,i.stage,i.provider,data.signer,base,ur,gr,data.rate_source,JSON.stringify({issuer:data.issuer,instructions:data.instructions,kind:data.kind,rectifies:i.number}),usd,gnf,'a_regler',created)]:[];
  await db.batch([...replacement,db.prepare('INSERT INTO invoice_corrections VALUES (?,?,?,?)').bind(cid,i.id,JSON.stringify(data),created),db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Facture rectifiée',JSON.stringify({original:i.number,rectification:data.number,reason:data.reason}),created),db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,'Document rectificatif disponible','Un document rectificatif concernant '+i.number+' est disponible. Consultez Documents.',created,'non_configure')]);await sendPending(db,runtime,owner,id);return json({ok:true,id:cid});
 }
 if(p[2]==='paid'){
  const b=await req.json() as any;if(b.verified!==true)return json({error:'Vérifiez le paiement avant de le valider.'},400);
  const i:any=await db.prepare('SELECT * FROM invoices WHERE id=? AND shipment_id=?').bind(b.invoiceId,id).first();if(!i)return json({error:'Facture introuvable.'},404);if(i.status==='paye')return json({ok:true});if(await db.prepare('SELECT id FROM invoice_corrections WHERE invoice_id=?').bind(i.id).first())return json({error:'Une rectification existe. Vérifiez le document avant tout règlement.'},409);
  await db.batch([db.prepare("UPDATE invoices SET status='paye' WHERE id=?").bind(i.id),db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,'Paiement validé','Votre agence a confirmé le paiement de la facture '+i.number+'.',now(),'non_configure'),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Paiement vérifié',i.number,now())]);await sendPending(db,runtime,owner,id);return json({ok:true});
 }
 if(p[2]==='link'){
  const secret=token(),expiry=new Date(Date.now()+7*86400000).toISOString();await db.batch([db.prepare('UPDATE shipments SET token_hash=?,token_expiry=? WHERE id=? AND owner=?').bind(await hash(secret),expiry,id,owner),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Lien privé renouvelé','Ancien lien révoqué',now())]);return json({ref:s.ref,access:secret,expiry});
 }
 if(p[2]==='events'){
  const b=await req.json() as any,planned=!!b.planned,published=b.published!==false,date=clean(b.date,40);
  if((b.lat!==undefined&&b.lat!==''&&(!Number.isFinite(Number(b.lat))||Math.abs(Number(b.lat))>90))||(b.lng!==undefined&&b.lng!==''&&(!Number.isFinite(Number(b.lng))||Math.abs(Number(b.lng))>180)))return json({error:'Coordonnées invalides.'},400);
  if(!eventTypes.includes(b.type)||!clean(b.place)||!clean(b.source)||!validActualDate(date,planned))return json({error:'Vérifiez le lieu, la source et la date. Une confirmation ne peut pas être future.'},400);
  if(b.type==='Livré'&&!clean(b.note))return json({error:'Indiquez la preuve ou la référence de remise dans la note.'},400);
  if(Number(b.version)!==s.version)return json({error:'Ce dossier a changé. Actualisez avant de publier.'},409);
  const targets=[s];if(b.bulk&&s.container){if(b.type==='Livré')return json({error:'Confirmez chaque livraison individuellement.'},400);for(const tid of (Array.isArray(b.ids)?b.ids.slice(0,50):[])){if(tid===id)continue;const t:any=await db.prepare('SELECT * FROM shipments WHERE id=? AND owner=? AND container=?').bind(tid,owner,s.container).first();if(!t)return json({error:'Sélection du conteneur invalide.'},409);if(!targets.some(x=>x.id===t.id))targets.push(t);}}
  const queries:any[]=[],created=now();for(const t of targets){
   const e={id:uuid(),type:b.type,date:new Date(date).toISOString(),created,planned:planned?1:0,published:published?1:0};const prev=(await db.prepare('SELECT * FROM events WHERE shipment_id=?').bind(t.id).all()).results;
   queries.push(db.prepare('INSERT INTO events (id,shipment_id,type,place,date,note,source,planned,published,created,author,published_at,lat,lng,mode) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM shipments WHERE id=? AND version=?)').bind(e.id,t.id,b.type,clean(b.place),e.date,clean(b.note,1500),clean(b.source),e.planned,e.published,created,owner,published?created:'',b.lat!==undefined&&b.lat!==''?Number(b.lat):null,b.lng!==undefined&&b.lng!==''?Number(b.lng):null,['Maritime','Aérien','Terrestre','Combiné'].includes(b.mode)?b.mode:'Maritime',t.id,t.version));
   queries.push(db.prepare('UPDATE shipments SET status=?,updated=?,version=version+1 WHERE id=? AND version=? AND EXISTS (SELECT 1 FROM events WHERE id=?)').bind(statusFromEvents([...prev,e]),created,t.id,t.version,e.id));
   queries.push(db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM events WHERE id=?)').bind(uuid(),owner,t.id,published?'Étape publiée':'Brouillon ajouté',`${b.type} • ${clean(b.place)}`,created,e.id));
  }
  if(published)for(let ti=0;ti<targets.length;ti++){
   const t=targets[ti];queries.push(db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) SELECT ?,?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM shipments WHERE id=? AND version=?)').bind(uuid(),owner,t.id,planned?'Nouvelle prévision':'Étape confirmée',`${b.type} • ${clean(b.place)}. ${clean(b.note,1000)}`,created,'non_configure',t.id,t.version+1));
  }
  const results=await db.batch(queries),count=results.slice(0,targets.length*3).filter((_:any,i:number)=>i%3===0).reduce((n:number,r:any)=>n+(r.meta.changes||0),0);if(!count)return json({error:'Modification concurrente. Actualisez le dossier.'},409);if(published)for(const t of targets)await sendPending(db,runtime,owner,t.id);return json({ok:true,count,partial:count<targets.length});
 }
 if(p[2]==='publish'){
  const b=await req.json() as any,e:any=await db.prepare('SELECT * FROM events WHERE id=? AND shipment_id=? AND published=0').bind(b.eventId,id).first();if(!e)return json({error:'Brouillon introuvable.'},404);
  if(!validActualDate(e.date,!!e.planned))return json({error:'Date future invalide pour une confirmation.'},400);
  if(Number(b.version)!==s.version)return json({error:'Dossier modifié. Actualisez avant de publier.'},409);
  const ev=(await db.prepare('SELECT * FROM events WHERE shipment_id=?').bind(id).all()).results.map((x:any)=>x.id===e.id?{...x,published:1}:x);
  const out=await db.batch([db.prepare('UPDATE events SET published=1,published_at=? WHERE id=? AND EXISTS (SELECT 1 FROM shipments WHERE id=? AND version=?)').bind(now(),e.id,id,s.version),db.prepare('UPDATE shipments SET status=?,updated=?,version=version+1 WHERE id=? AND version=?').bind(statusFromEvents(ev),now(),id,s.version),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Brouillon publié',e.type,now())]);if(!out[0].meta.changes)return json({error:'Modification concurrente. Actualisez.'},409);await db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,e.planned?'Nouvelle prévision':'Étape confirmée',e.type+' • '+e.place+'. '+e.note,now(),'non_configure').run();await sendPending(db,runtime,owner,id);return json({ok:true});
 }
 if(p[2]==='eta'){
  const b=await req.json() as any;if(b.eta&&!Number.isFinite(Date.parse(b.eta)))return json({error:'Date invalide.'},400);if(!clean(b.reason))return json({error:'Précisez le motif.'},400);if(Number(b.version)!==s.version)return json({error:'Dossier modifié. Actualisez.'},409);
  const a=await db.batch([db.prepare('UPDATE shipments SET eta=?,updated=?,version=version+1 WHERE id=? AND version=?').bind(clean(b.eta),now(),id,s.version),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(uuid(),owner,id,'Estimation révisée',`${s.eta||'Non définie'} → ${clean(b.eta)||'Non définie'} • ${clean(b.reason)}`,now())]);if(!a[0].meta.changes)return json({error:'Modification concurrente. Actualisez.'},409);await db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?,?,0)').bind(uuid(),owner,id,'Estimation révisée',clean(b.reason,1000),now(),'non_configure').run();await sendPending(db,runtime,owner,id);return json({ok:true});
 }
 if(p[2]==='documents'){
  const form=await req.formData(),file=form.get('file');if(form.get('kind')&&!documentKinds.includes(String(form.get('kind'))))return json({error:'Type de document invalide.'},400);if(!(file instanceof File)||file.size>10*1024*1024||file.size===0)return json({error:'Choisissez un PDF, JPG ou PNG de moins de 10 Mo.'},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),sig=Array.from(bytes.slice(0,8)).map(x=>x.toString(16).padStart(2,'0')).join('');const mime=sig.startsWith('25504446')?'application/pdf':sig.startsWith('ffd8ff')?'image/jpeg':sig.startsWith('89504e470d0a1a0a')?'image/png':'';
  if(!mime||!env.BUCKET)return json({error:'Format refusé ou stockage indisponible.'},400);const fid=uuid(),key=owner+'/'+id+'/'+fid;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{await db.batch([db.prepare('INSERT INTO documents (id,shipment_id,name,key,mime,size,shared,created) VALUES (?,?,?,?,?,?,?,?)').bind(fid,id,clean(file.name,160),key,mime,file.size,form.get('shared')==='true'?1:0,now()),db.prepare('INSERT INTO document_details VALUES (?,?,?)').bind(fid,String(form.get('kind')||'Autre'),clean(form.get('note'),1000)),db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uuid(),owner,id,'Document ajouté',clean(file.name,160),now())]);}catch(e){await env.BUCKET.delete(key);throw e;}return json({ok:true});
 }
 return json({error:'Action inconnue.'},404);
}
async function safe(req:Request){try{return await handle(req);}catch{return json({error:'L’action n’a pas pu être enregistrée. Réessayez.'},500);}}
export const GET=safe;export const POST=safe;
