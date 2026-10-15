import {clean} from '../app/domain';
import {sendPending} from '../app/notifier';
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function serviceTasks(db:any,shipmentId:string){
 const rows=(await db.prepare('SELECT t.*,i.number,i.status AS payment_status FROM service_tasks t JOIN invoices i ON i.id=t.invoice_id WHERE t.shipment_id=? ORDER BY t.updated').bind(shipmentId).all()).results;
 const corrected=(await db.prepare('SELECT c.invoice_id FROM invoice_corrections c JOIN invoices i ON i.id=c.invoice_id WHERE i.shipment_id=?').bind(shipmentId).all()).results;
 return rows.map((r:any)=>({...r,state:r.status==='confirmed'?'confirmed':corrected.some((c:any)=>c.invoice_id===r.invoice_id)?'rectified':r.requires_payment&&r.payment_status!=='paye'?'awaiting_payment':'ready'}));
}
export async function confirmService(req:Request,db:any,owner:string,shipmentId:string,runtime:any){
 const b:any=await req.json();
 const t:any=await db.prepare('SELECT t.*,s.owner FROM service_tasks t JOIN shipments s ON s.id=t.shipment_id WHERE t.id=? AND t.shipment_id=? AND s.owner=?').bind(clean(b.taskId),shipmentId,owner).first();
 if(!t)return json({error:'Prestation inaccessible.'},403);
 if(t.status==='confirmed')return json({ok:true});
 if(!clean(b.source)||Number(b.version)!==t.version)return json({error:'Précisez la confirmation réelle et actualisez la prestation.'},409);
 const guard=uid(),created=now();
 const out=await db.batch([
  db.prepare("UPDATE service_tasks SET status='confirmed',source=?,confirmed_at=?,updated=?,version=version+1 WHERE id=? AND version=? AND NOT EXISTS (SELECT 1 FROM invoice_corrections WHERE invoice_id=service_tasks.invoice_id) AND (requires_payment=0 OR EXISTS (SELECT 1 FROM invoices WHERE id=service_tasks.invoice_id AND status='paye'))").bind(clean(b.source,1000),created,created,t.id,t.version),
  db.prepare('INSERT INTO audit SELECT ?,?,?,?,?,? WHERE changes()>0').bind(guard,owner,shipmentId,'Prestation prise en charge',JSON.stringify({task:t.id,action:t.action,source:clean(b.source,1000)}),created),
  db.prepare('INSERT INTO notifications(id,owner,shipment_id,title,body,created,email_status,attempts) SELECT ?,?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM audit WHERE id=?)').bind(uid(),owner,shipmentId,'Prestation prise en charge',t.action+' : '+clean(b.source,1000)+'. Les mouvements sont confirmés séparément.',created,'non_configure',guard)
 ]);
 if(!out[0].meta.changes)return json({error:'Paiement non validé, facture rectifiée ou prestation modifiée. Actualisez avant de confirmer.'},409);
 await sendPending(db,runtime,owner,shipmentId);return json({ok:true});
}
