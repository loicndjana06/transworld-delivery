export async function sendPending(db:any,runtime:any,owner:string,shipmentId:string){
 const hasEmailConfig = Boolean(runtime?.EMAIL_API_KEY && String(runtime.EMAIL_API_KEY).trim() && runtime?.EMAIL_FROM && String(runtime.EMAIL_FROM).trim());
 const rows=(await db.prepare("SELECT n.*,s.email,s.ref FROM notifications n JOIN shipments s ON s.id=n.shipment_id WHERE n.owner=? AND n.shipment_id=? AND n.email_status IN ('non_configure','echec','adresse_absente') AND n.attempts<3 ORDER BY n.created").bind(owner,shipmentId).all()).results;
 const deadline=runtime.emailDeadline||Date.now()+12000;
 for(const n of rows){
  if(Date.now()>=deadline)break;
  if(!n.email||!/^\S+@\S+\.\S+$/.test(n.email)){
   if(n.email_status!=='adresse_absente')await db.prepare("UPDATE notifications SET email_status='adresse_absente' WHERE id=?").bind(n.id).run();
   continue;
  }
  if(!hasEmailConfig){
   if(n.email_status!=='non_configure')await db.prepare("UPDATE notifications SET email_status='non_configure' WHERE id=?").bind(n.id).run();
   continue;
  }
  try{
   const res=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
     Authorization:'Bearer '+String(runtime.EMAIL_API_KEY).trim(),
     'Content-Type':'application/json',
     'Idempotency-Key':n.id
    },
    body:JSON.stringify({
     from:String(runtime.EMAIL_FROM).trim(),
     to:[n.email],
     subject:'TRANSWORLD DELIVERY • '+n.title,
     text:n.body+'\nRéférence : '+n.ref+'\nConsultez votre suivi avec le lien privé fourni par votre agence.'
    }),
    signal:AbortSignal.timeout(Math.max(1,Math.min(8000,deadline-Date.now())))
   });
   await db.prepare('UPDATE notifications SET email_status=?,attempts=attempts+1 WHERE id=?').bind(res.ok?'envoye':'echec',n.id).run();
  }catch{
   await db.prepare("UPDATE notifications SET email_status='echec',attempts=attempts+1 WHERE id=?").bind(n.id).run();
  }
 }
}

