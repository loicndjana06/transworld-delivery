import {invoicePdf} from './invoice-pdf';
import {parseMoney} from './money';
import {companyData} from './business';
import {clean} from './domain';
import {getDetails,unpack} from './business';
import {validateRoute} from './maritime';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
// Drafts are stored separately from published billing documents, in existing per-shipment JSON.
export async function workflowRoutes(req:Request,p:string[],db:any,owner:string,s:any){
 if(!['billing-draft','billing-preview','route-config'].includes(p[2]))return null;
 if(p[2]==='billing-preview'){if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405);try{const b:any=await req.json(),d=b.draft||{},money=parseMoney(d.displayAmount,d.displayCurrency,true);const bytes=await invoicePdf(s,{...Object.fromEntries(['title','reason','stage','provider','signer','instructions','dueDate','serviceAction'].map(k=>[k,clean(d[k],2000)])),requiresPayment:d.requiresPayment===true,kind:d.documentKind==='Pro forma'?'PRO FORMA · BROUILLON':'FACTURE · BROUILLON',displayMoney:money,issuer:await companyData(db,owner),number:'BROUILLON-'+s.ref,status:'Brouillon · non émis',created:new Date().toISOString()});return new Response(bytes as any,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Brouillon-'+s.ref+'.pdf"','Cache-Control':'no-store'}});}catch(e:any){return json({error:e.message},400);}}
 const extra=await getDetails(db,s.id);
 if(req.method==='GET')return json(p[2]==='billing-draft'?{draft:extra.adminBillingDraft||null,version:s.version}:{route:extra.routeConfig||null,version:s.version});
 if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405);
 const b:any=await req.json();if(Number(b.version)!==s.version)return json({error:'Le dossier a changé. Actualisez avant de sauvegarder.'},409);
 try{
 if(p[2]==='billing-draft'){
  const d:any={};for(const k of ['title','reason','stage','serviceAction','provider','signer','displayAmount','displayCurrency','justificationDocument','serviceId','serviceCategory','dueDate','instructions','documentKind'])d[k]=clean(b.draft?.[k],['reason','instructions'].includes(k)?2000:500);
  d.requiresPayment=b.draft?.requiresPayment===true;d.sendEmail=b.draft?.sendEmail===true;extra.adminBillingDraft=b.clear?null:d;
 }else extra.routeConfig=b.route?validateRoute(b.route):null;
 const at=new Date().toISOString(),guard=crypto.randomUUID();const out=await db.batch([
 db.prepare('UPDATE shipments SET version=version+1 WHERE id=? AND owner=? AND version=?').bind(s.id,owner,s.version),
 db.prepare('INSERT INTO audit SELECT ?,?,?,?,?,? WHERE changes()>0').bind(guard,owner,s.id,p[2]==='billing-draft'?'Brouillon de facturation enregistré':'Parcours configuré','Aucun mouvement ni paiement confirmé',at),
 db.prepare('INSERT INTO shipment_details SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM audit WHERE id=?) ON CONFLICT(shipment_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(s.id,JSON.stringify(extra),at,guard)]);
 if(!out[0].meta.changes)return json({error:'Modification concurrente.'},409);return json({ok:true,version:s.version+1});
 }catch(e:any){return json({error:e.message},400);}
}
