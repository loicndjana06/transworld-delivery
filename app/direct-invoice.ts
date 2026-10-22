import {parseMoney,formatMoney,invoiceMoney} from './money';
import {companyData,unpack} from './business';
import {clean} from './domain';
import {sendPending} from './notifier';
const uid=()=>crypto.randomUUID(),json=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function directMoneyRoute(req:Request,p:string[],db:any,owner:string,s:any,runtime:any){
 if(!['invoices','rectify'].includes(p[2])||req.method!=='POST')return null;
 const b:any=await req.clone().json();
 const original:any=p[2]==='rectify'?await db.prepare('SELECT * FROM invoices WHERE id=? AND shipment_id=?').bind(b.invoiceId,s.id).first():null;
 if(p[2]==='rectify'&&!original)return json({error:'Facture introuvable.'},404);
 const oldMoney=original?invoiceMoney(original):null;
 if(b.displayAmount==null&&!(p[2]==='rectify'&&oldMoney))return null;
 try{
  const credit=p[2]==='rectify'&&b.kind==='Avoir intégral';
  if(p[2]==='rectify'&&!['Avoir intégral','Facture rectificative'].includes(b.kind))return json({error:'Type de correction invalide.'},400);
  if(p[2]==='rectify'&&original.status==='paye'&&!credit)return json({error:'Facture payée : réconciliez les fonds avant tout remplacement.'},409);
  if(original&&await db.prepare('SELECT id FROM invoice_corrections WHERE invoice_id=?').bind(original.id).first())return json({error:'Cette facture dispose déjà d’un rectificatif.'},409);
  const money=credit?oldMoney:parseMoney(b.displayAmount,b.displayCurrency,true);if(!money)return null;
  if(!clean(b.reason)||(!original&&(!clean(b.stage)||!clean(b.provider)||!clean(b.signer))))return json({error:'Renseignez la prestation, le motif, le prestataire et le responsable.'},400);
  const issuer=original?(unpack(original.metadata).issuer||await companyData(db,owner)):await companyData(db,owner);
  if(!issuer.name||!issuer.address)return json({error:'Complétez le nom et l’adresse de l’entreprise avant émission.'},400);
  if(b.serviceId&&!await db.prepare('SELECT id FROM admin_models WHERE id=? AND owner=? AND kind=?').bind(clean(b.serviceId),owner,'service').first())return json({error:'Prestation inaccessible.'},403);
  const justification=clean(b.justificationDocument);if(justification&&!await db.prepare('SELECT id FROM documents WHERE id=? AND shipment_id=?').bind(justification,s.id).first())return json({error:'Justificatif inaccessible.'},403);
  const requestKey=!original&&typeof b.requestKey==='string'&&/^[0-9a-f-]{36}$/i.test(b.requestKey)?b.requestKey:null;
  if(requestKey){
   const prior:any=await db.prepare('SELECT * FROM invoices WHERE id=?').bind(requestKey).first();
   if(prior){
    if(prior.shipment_id!==s.id)return json({error:'Requête incompatible.'},409);
    const pm=invoiceMoney(prior),meta=unpack(prior.metadata);
    const unchanged=pm&&Number(pm.amount)===Number(money.amount)&&pm.currency===money.currency&&prior.reason===clean(b.reason,1000)&&prior.stage===clean(b.stage)&&prior.provider===clean(b.provider)&&prior.signer===clean(b.signer)&&meta.title===(clean(b.title,200)||clean(b.reason,1000))&&meta.documentKind===(b.documentKind==='Pro forma'?'Pro forma':'Facture')&&meta.instructions===(clean(b.instructions,2000)||issuer.paymentInstructions||'')&&meta.serviceAction===clean(b.serviceAction,1000)&&meta.requiresPayment===(b.requiresPayment===true)&&meta.dueDate===clean(b.dueDate,10);
    if(!unchanged)return json({error:'Une demande a déjà été publiée depuis ce formulaire avec un contenu différent. Rouvrez le dossier et utilisez Rectifier pour corriger le document existant.',existingInvoiceId:prior.id},409);
    return json({ok:true,id:prior.id});
   }
  }
  const created=new Date().toISOString(),id=requestKey||uid(),number='TD-'+(original?'R-':'')+new Date().getUTCFullYear()+'-'+uid().slice(0,10).toUpperCase(),signer=clean(b.signer)||original?.signer,reason=clean(b.reason,1000),stage=original?.stage||clean(b.stage),provider=original?.provider||clean(b.provider);
  if(b.dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)||!Number.isFinite(Date.parse(b.dueDate))))return json({error:'Échéance invalide.'},400);
  const meta={title:clean(b.title,200)||reason,serviceAction:clean(b.serviceAction,1000),requiresPayment:b.requiresPayment===true,dueDate:clean(b.dueDate,10),documentKind:b.documentKind==='Pro forma'?'Pro forma':'Facture',kind:!original&&b.documentKind==='Pro forma'?'PRO FORMA':undefined,displayMoney:money,issuer,instructions:clean(b.instructions,2000)||issuer.paymentInstructions||'',category:clean(b.serviceCategory),justificationDocument:justification,serviceId:clean(b.serviceId),...(original?{kind:b.kind,rectifies:original.number}:{})};
  // Legacy conversion columns stay neutral. The immutable amount and currency live in metadata.
  const queries=[];
  if(!credit)queries.push(db.prepare('INSERT INTO invoices (id,shipment_id,number,reason,stage,provider,signer,base_xaf,usd_rate,gnf_rate,rate_source,metadata,usd,gnf,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,s.id,number,reason,stage,provider,signer,0,0,0,'',JSON.stringify(meta),0,0,'a_regler',created));
  if(!original&&(b.requiresPayment===true||clean(b.serviceAction)))queries.push(db.prepare('INSERT INTO service_tasks(id,shipment_id,invoice_id,action,requires_payment,updated) VALUES (?,?,?,?,?,?)').bind(uid(),s.id,id,clean(b.serviceAction)||reason,b.requiresPayment===true?1:0,created));
  if(original){const previous:any=await db.prepare('SELECT * FROM service_tasks WHERE invoice_id=?').bind(original.id).first();if(!credit&&previous?.status==='pending')queries.push(db.prepare('INSERT INTO service_tasks(id,shipment_id,invoice_id,action,requires_payment,updated) VALUES (?,?,?,?,?,?)').bind(uid(),s.id,id,previous.action,previous.requires_payment,created));const data={...meta,kind:b.kind,number,reason,stage,provider,signer,usd:0,gnf:0,gnf_rate:0,rate_source:'',replacementInvoiceId:credit?null:id,originalStatus:original.status};queries.push(db.prepare('INSERT INTO invoice_corrections VALUES (?,?,?,?)').bind(uid(),original.id,JSON.stringify(data),created));}
  queries.push(db.prepare('INSERT INTO audit (id,owner,shipment_id,action,detail,created) VALUES (?,?,?,?,?,?)').bind(uid(),owner,s.id,original?'Facture rectifiée':'Facture émise',JSON.stringify({number,displayMoney:money,original:original?.number}),created));
  queries.push(db.prepare('INSERT INTO notifications (id,owner,shipment_id,title,body,created,email_status,attempts) VALUES (?,?,?,?,?,?,?,0)').bind(uid(),owner,s.id,original?'Document rectificatif disponible':b.documentKind==='Pro forma'?'Pro forma disponible':'Facture disponible',reason+' : '+formatMoney(money)+'. Consultez le document dans votre dossier.',created,b.sendEmail===false?'desactive':'non_configure'));
  await db.batch(queries);await sendPending(db,runtime,owner,s.id);return json({ok:true,id});
 }catch(e:any){return json({error:e.message||'Montant invalide.'},400);}
}
