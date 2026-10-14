export async function sendPending(db:any,runtime:any,owner:string,shipmentId:string){
 const rows=(await db.prepare("SELECT n.*,s.email,s.ref FROM notifications n JOIN shipments s ON s.id=n.shipment_id WHERE n.owner=? AND n.shipment_id=? AND n.email_status IN ('non_configure','echec','adresse_absente') AND n.attempts<3 ORDER BY n.created").bind(owner,shipmentId).all()).results;
 for(const n of rows){
  if(!n.email||!/^\S+@\S+\.\S+$/.test(n.email)){await db.prepare("UPDATE notifications SET email_status='adresse_absente' WHERE id=?").bind(n.id).run();continue;}
  if(!runtime.EMAIL_API_KEY||!runtime.EMAIL_FROM)continue;
  try{const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+runtime.EMAIL_API_KEY,'Content-Type':'application/json','Idempotency-Key':n.id},body:JSON.stringify({from:runtime.EMAIL_FROM,to:[n.email],subject:'TRANSWORLD DELIVERY • '+n.title,text:n.body+'\nRéférence : '+n.ref+'\nConsultez votre suivi avec le lien privé fourni par votre agence.'}),signal:AbortSignal.timeout(8000)});await db.prepare('UPDATE notifications SET email_status=?,attempts=attempts+1 WHERE id=?').bind(res.ok?'envoye':'echec',n.id).run();}catch{await db.prepare("UPDATE notifications SET email_status='echec',attempts=attempts+1 WHERE id=?").bind(n.id).run();}
 }
}
