import {clean} from '../app/domain';
import {documentKinds} from '../app/business';
import {hashString} from './supabase-service';
import {allowAttempt} from './security';
import {sendPending} from '../app/notifier';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
export function fileMime(bytes:Uint8Array){
 const sig=Array.from(bytes.subarray(0,8)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return sig.startsWith('25504446')?'application/pdf':sig.startsWith('ffd8ff')?'image/jpeg':sig.startsWith('89504e470d0a1a0a')?'image/png':'';
}

// Only small JSON requests traverse Vercel. Bytes go to the private bucket.
export async function uploadRoute(req:Request,action:string,db:any,bucket:any,owner:string|undefined,runtime:any={}){
 if(!bucket?.createUploadUrl)return json({error:'Stockage privé non configuré.'},503);
 const b:any=await req.json();
 const intent:any=action==='upload-finalize'?await db.prepare('SELECT * FROM cargo_uploads WHERE id=?').bind(clean(b.id)).first():null;
 if(action==='upload-finalize'&&!intent)return json({error:'Import inaccessible.'},404);
 const invoiceId=intent?.invoice_id||clean(b.invoiceId);
 const invoice:any=invoiceId?await db.prepare('SELECT * FROM invoices WHERE id=?').bind(invoiceId).first():null;
 const shipmentId=intent?.shipment_id||invoice?.shipment_id||clean(b.shipmentId);
 const shipment:any=await db.prepare('SELECT * FROM shipments WHERE id=?').bind(shipmentId).first();
 if(!shipment)return json({error:'Dossier inaccessible.'},403);
 const admin=owner===shipment.owner;
 const privateAccess=admin||(invoice&&clean(b.access,200)&&shipment.token_hash===await hashString(clean(b.access,200))&&shipment.token_expiry>now());
 if(invoiceId&&!invoice)return json({error:'Facture inaccessible.'},403);
 if(!admin&&!privateAccess)return json({error:'Accès refusé. Vérifiez votre lien privé.'},403);
 if(!invoice&&!admin)return json({error:'Accès administrateur requis.'},403);
 if(invoice&&(invoice.status==='paye'||await db.prepare('SELECT id FROM invoice_corrections WHERE invoice_id=?').bind(invoice.id).first()))return json({error:'Cette facture est payée ou rectifiée. Contactez votre agence.'},409);

 if(action==='upload-intent'){
  if(!await allowAttempt(req,'private-upload',15))return json({error:'Trop d’imports. Réessayez dans 15 minutes.'},429);
  const name=clean(b.name,160),size=Number(b.size),mime=clean(b.mime);
  const kind=invoice?'Preuve de paiement':clean(b.kind)||'Autre';
  if(!name||!Number.isInteger(size)||size<1||size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(mime)||(!invoice&&!documentKinds.includes(kind)))return json({error:'PDF, JPG ou PNG requis, 10 Mo maximum.'},400);
  const id=uid(),key=shipment.owner+'/'+shipment.id+'/'+id;
  const signed=await bucket.createUploadUrl(key);
  await db.prepare('INSERT INTO cargo_uploads(id,shipment_id,invoice_id,object_key,name,mime,size,kind,shared,expires) VALUES (?,?,?,?,?,?,?,?,?,?)')
   .bind(id,shipment.id,invoice?.id||null,key,name,mime,size,kind,invoice?0:b.shared===true?1:0,new Date(Date.now()+15*60000).toISOString()).run();
  return json({id,url:signed.signedUrl});
 }
 if(intent.completed_at)return json({ok:true,id:intent.id});
 if(Date.parse(intent.expires)<=Date.now())return json({error:'Autorisation d’import expirée. Recommencez l’import.'},410);
 const object=await bucket.get(intent.object_key);
 if(!object)return json({error:'Fichier pas encore reçu par le stockage. Réessayez.'},409);
 const bytes=new Uint8Array(object.arrayBuffer?await object.arrayBuffer():object.body);
 if(bytes.byteLength!==intent.size||fileMime(bytes)!==intent.mime){
  await bucket.delete(intent.object_key);
  return json({error:'Taille ou contenu du fichier invalide. Recommencez l’import.'},400);
 }
 const guard=uid(),created=now();
 const q=[
  db.prepare('UPDATE cargo_uploads SET completed_at=? WHERE id=? AND completed_at IS NULL AND expires>?').bind(created,intent.id,created),
  db.prepare('INSERT INTO audit SELECT ?,?,?,?,?,? WHERE changes()>0').bind(guard,shipment.owner,shipment.id,invoice?'Preuve de paiement reçue':'Document ajouté',invoice?.number||intent.name,created),
  db.prepare('INSERT INTO documents(id,shipment_id,name,key,mime,size,shared,created) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM audit WHERE id=?)').bind(intent.id,shipment.id,invoice?'Preuve '+invoice.number+' '+intent.name:intent.name,intent.object_key,intent.mime,intent.size,intent.shared,created,guard),
  db.prepare('INSERT INTO document_details(document_id,kind,note) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM audit WHERE id=?)').bind(intent.id,intent.kind,'',guard)
 ];
 if(invoice){
  // Serialize payment/proof/correction changes through the same PostgreSQL batch.
  q.push(db.prepare("UPDATE invoices SET status='preuve_recue' WHERE id=? AND status<>'paye' AND NOT EXISTS (SELECT 1 FROM invoice_corrections WHERE invoice_id=?) AND EXISTS (SELECT 1 FROM audit WHERE id=?)").bind(invoice.id,invoice.id,guard));
  q.push(db.prepare('INSERT INTO notifications(id,owner,shipment_id,title,body,created,email_status,attempts) SELECT ?,?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM audit WHERE id=?)').bind(uid(),shipment.owner,shipment.id,'Preuve de paiement reçue','La preuve pour '+invoice.number+' est reçue. L’agence doit vérifier les fonds.',created,'non_configure',guard));
 }
 const result=await db.batch(q);
 if(!result[0].meta.changes){const done=await db.prepare('SELECT completed_at FROM cargo_uploads WHERE id=?').bind(intent.id).first();if(!done?.completed_at)return json({error:'Import expiré. Recommencez.'},410);}
 if(invoice)await sendPending(db,runtime,shipment.owner,shipment.id);
 return json({ok:true,id:intent.id});
}
