// Adaptateur REST Supabase préparé. Non activé dans le Site courant.
export function supabaseRepository(url:string,publishableKey:string,token:()=>Promise<string|null>){
 if(!url.startsWith('https://')||!publishableKey)throw new Error('URL et clé publique Supabase nécessaires.');
 const base=url.replace(/\/$/,'');
 async function call(path:string,method='GET',body?:unknown){const access=await token();const res=await fetch(base+path,{method,headers:{apikey:publishableKey,...(access?{Authorization:'Bearer '+access}:{}),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});if(!res.ok)throw new Error('Supabase : accès refusé ou configuration incorrecte ('+res.status+').');return res.status===204?null:res.json();}
 return {
  signIn:(email:string,password:string)=>call('/auth/v1/token?grant_type=password','POST',{email,password}),
  publicTracking:(reference:string)=>call('/rest/v1/rpc/get_public_tracking','POST',{p_ref:reference.trim().toUpperCase()}),
  listShipments:(agencyId:string)=>call('/rest/v1/shipments?agency_id=eq.'+encodeURIComponent(agencyId)+'&order=updated.desc'),
  createShipment:(data:Record<string,unknown>)=>call('/rest/v1/shipments','POST',data),
  updateShipment:(id:string,version:number,data:Record<string,unknown>)=>call('/rest/v1/shipments?id=eq.'+encodeURIComponent(id)+'&version=eq.'+version,'PATCH',{...data,version:version+1,updated:new Date().toISOString()}),
  addEvent:(data:Record<string,unknown>)=>call('/rest/v1/events','POST',data),
  readInvoices:(shipmentId:string)=>call('/rest/v1/invoices?shipment_id=eq.'+encodeURIComponent(shipmentId)+'&order=created'),
  readNotifications:(shipmentId:string)=>call('/rest/v1/notifications?shipment_id=eq.'+encodeURIComponent(shipmentId)+'&order=created.desc'),
  async uploadDocument(agencyId:string,shipmentId:string,file:File){if(file.size>10*1024*1024)throw new Error('Limite 10 Mo.');const access=await token();if(!access)throw new Error('Connexion requise.');const path=agencyId+'/'+shipmentId+'/'+crypto.randomUUID();const res=await fetch(base+'/storage/v1/object/cargo-documents/'+path,{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+access,'Content-Type':file.type},body:file});if(!res.ok)throw new Error('Dépôt refusé.');return {path,name:file.name,mime:file.type,size:file.size};},
 };
}
