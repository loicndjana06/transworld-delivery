// Backups are private, bounded and restored only into an empty account.
const defs:Record<string,{cols:string[],scope:string}>={
 shipments:{cols:'id owner ref client contact item category origin destination container vehicle_xaf order_usd order_gnf email delivery eta status created updated version'.split(' '),scope:'owner=?'},
 admin_models:{cols:'id owner kind name config version created updated'.split(' '),scope:'owner=?'},
 company_settings:{cols:'owner data version'.split(' '),scope:'owner=?'},
 events:{cols:'id shipment_id type place date note source planned published created author published_at lat lng mode'.split(' '),scope:'shipment_id IN (SELECT id FROM shipments WHERE owner=?)'},
 shipment_details:{cols:'shipment_id data updated'.split(' '),scope:'shipment_id IN (SELECT id FROM shipments WHERE owner=?)'},
 invoices:{cols:'id shipment_id number reason stage provider signer base_xaf usd_rate gnf_rate rate_source metadata usd gnf status created'.split(' '),scope:'shipment_id IN (SELECT id FROM shipments WHERE owner=?)'},
 invoice_corrections:{cols:'id invoice_id data created'.split(' '),scope:'invoice_id IN (SELECT id FROM invoices WHERE shipment_id IN (SELECT id FROM shipments WHERE owner=?))'},
 documents:{cols:'id shipment_id name mime size shared created'.split(' '),scope:'shipment_id IN (SELECT id FROM shipments WHERE owner=?)'},
 document_details:{cols:'document_id kind note'.split(' '),scope:'document_id IN (SELECT id FROM documents WHERE shipment_id IN (SELECT id FROM shipments WHERE owner=?))'},
 event_history:{cols:'id event_id before reason created'.split(' '),scope:'event_id IN (SELECT id FROM events WHERE shipment_id IN (SELECT id FROM shipments WHERE owner=?))'},
 notifications:{cols:'id owner shipment_id title body created email_status attempts'.split(' '),scope:'owner=?'},
 requests:{cols:'id owner name contact origin destination category note created'.split(' '),scope:'owner=?'},
 audit:{cols:'id owner shipment_id action detail created'.split(' '),scope:'owner=?'},
};
const j=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
export async function backupRoute(req:Request,db:any,bucket:any,owner:string){
 if(!bucket)return j({error:'Stockage indisponible.'},503);
 if(req.method==='GET'){
  const tables:any={};for(const [name,d]of Object.entries(defs)){const r=(await db.prepare(`SELECT ${d.cols.join(',')} FROM ${name} WHERE ${d.scope} LIMIT 501`).bind(owner).all()).results;if(r.length>500)return j({error:'Sauvegarde trop volumineuse pour cet export. Utilisez une sauvegarde externe complète.'},413);tables[name]=r;}
  if(tables.documents.length>50)return j({error:'Cet export est limité à 50 fichiers. Prévoir une sauvegarde externe pour ce volume.'},413);let total=0;const files:any={};
  for(const d of tables.documents){const row:any=await db.prepare('SELECT key FROM documents WHERE id=?').bind(d.id).first(),obj=await bucket.get(row.key);if(!obj)return j({error:'Fichier absent : '+d.name+'. Sauvegarde interrompue.'},409);let bytes:Uint8Array;if(obj.arrayBuffer)bytes=new Uint8Array(await obj.arrayBuffer());else bytes=typeof obj.body==='string'?new TextEncoder().encode(obj.body):new Uint8Array(obj.body);total+=bytes.byteLength;if(total>20*1024*1024)return j({error:'Les fichiers dépassent la limite de 20 Mo de cet export.'},413);let raw='';for(let k=0;k<bytes.length;k+=8192)raw+=String.fromCharCode(...bytes.subarray(k,k+8192));files[d.id]=btoa(raw);}
  return j({format:'TRANSWORLD_BACKUP',version:1,created:new Date().toISOString(),tables,files,notice:'Confidentiel. Les liens privés, sessions et clés ne sont pas exportés. À conserver dans un emplacement protégé.'});
 }
 const b:any=await req.json();if(b.confirm!=='RESTAURER COMPTE VIDE'||b.backup?.format!=='TRANSWORLD_BACKUP'||b.backup?.version!==1)return j({error:'Sauvegarde ou confirmation invalide.'},400);
 const data=b.backup;if(!data.tables||!data.files)return j({error:'Sauvegarde incomplète.'},400);if(new TextEncoder().encode(JSON.stringify(data)).length>30*1024*1024)return j({error:'Sauvegarde trop volumineuse.'},413);
 for(const[name,d]of Object.entries(defs)){if(!Array.isArray(data.tables[name])||data.tables[name].length>500)return j({error:'Table invalide : '+name},400);if(await db.prepare(`SELECT 1 FROM ${name} WHERE ${d.scope} LIMIT 1`).bind(owner).first())return j({error:'Restauration refusée : le compte doit être vide. Aucun dossier n’a été remplacé.'},409);}
 if(data.tables.documents.length>50)return j({error:'Trop de fichiers.'},413);
 const ids=new Map<string,string>();for(const rows of Object.values(data.tables)as any[])for(const row of rows)if(row.id){if(ids.has(row.id))return j({error:'Identifiants dupliqués dans la sauvegarde.'},400);ids.set(row.id,crypto.randomUUID());}
 const refs:any={shipment_id:new Set(data.tables.shipments.map((r:any)=>r.id)),invoice_id:new Set(data.tables.invoices.map((r:any)=>r.id)),document_id:new Set(data.tables.documents.map((r:any)=>r.id)),event_id:new Set(data.tables.events.map((r:any)=>r.id))};
 const remap=(x:any):any=>typeof x==='string'?ids.get(x)||x:Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
 const queries:any[]=[],files:string[]=[];let bytesTotal=0;
 try{
  for(const[name,d]of Object.entries(defs))for(const row of data.tables[name]){
   if(!row||typeof row!=='object')throw new Error('Ligne invalide.');const v:any={};for(const c of d.cols){if(row[c]!==null&&!['string','number'].includes(typeof row[c]))throw new Error('Valeur invalide : '+name+'.'+c);v[c]=row[c];}
   for(const c of Object.keys(refs))if(c in v&&v[c]&&!(name==='audit'&&c==='shipment_id'&&!v[c])){if(!refs[c].has(v[c]))throw new Error('Référence inaccessible : '+c);v[c]=ids.get(v[c]);}
   if('id'in v)v.id=ids.get(row.id);if('owner'in v)v.owner=owner;if('author'in v)v.author=owner;
   for(const c of ['data','metadata','config','before','detail'])if(typeof v[c]==='string'){try{v[c]=JSON.stringify(remap(JSON.parse(v[c])));}catch{}}
   if(name==='shipments'){v.token_hash='';v.token_expiry='';if(!/^KC-[A-F0-9]{16}$/.test(v.ref))throw new Error('Référence de suivi invalide.');}
   if(name==='notifications'){v.email_status='non_configure';v.attempts=0;}
   if(name==='documents'){
    if(typeof data.files[row.id]!=='string')throw new Error('Fichier absent.');const raw=atob(data.files[row.id]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));bytesTotal+=bytes.length;if(bytes.length!==Number(v.size)||bytes.length>10*1024*1024||bytesTotal>20*1024*1024)throw new Error('Taille de fichier invalide.');
    const sig=Array.from(bytes.subarray(0,8)).map(x=>x.toString(16).padStart(2,'0')).join(''),mime=sig.startsWith('25504446')?'application/pdf':sig.startsWith('ffd8ff')?'image/jpeg':sig.startsWith('89504e470d0a1a0a')?'image/png':'';if(!mime||mime!==v.mime)throw new Error('Format de fichier invalide.');v.key=owner+'/'+v.shipment_id+'/'+v.id;await bucket.put(v.key,bytes,{httpMetadata:{contentType:mime}});files.push(v.key);
   }
   const cols=Object.keys(v);queries.push(db.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...cols.map(k=>v[k])));
  }
  queries.push(db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,'','Sauvegarde restaurée','Liens privés révoqués ; courriels non envoyés.',new Date().toISOString()));await db.batch(queries);return j({ok:true,count:data.tables.shipments.length});
 }catch(e:any){for(const k of files)await bucket.delete(k);return j({error:'Restauration interrompue : '+e.message},400);}
}
